using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using XUnitTest.Shared;

namespace XUnitTest.Routing;

/// <summary>
/// Runs the timeline overview aggregation against local MongoDB: mocks can check the rendered pipeline,
/// but not what MongoDB does with it ($first after $sort, $facet counts, the 64-bit $skip, index conflicts).
/// </summary>
public class LocalizationTimelineQueryTests : IDisposable
{
    private static readonly DateTime T0 = new(2026, 10, 1, 10, 0, 0, DateTimeKind.Utc);
    private static readonly List<string> PortalExcludes = new()
    {
        "KeyController.Create", "KeyController.Save", "KeyController.Delete", "TranslateKey", "Rollback"
    };

    private readonly TenantPlacementFixture _fixture = new();
    private readonly Mock<ILogger<KeyTimelineRepository>> _logger = new();
    private readonly KeyTimelineRepository _repository;

    public LocalizationTimelineQueryTests()
    {
        var configuration = new Mock<IConfiguration>();
        configuration.Setup(c => c["RootTenantId"]).Returns("root");
        _repository = new KeyTimelineRepository(_fixture.Provider, configuration.Object, _logger.Object);
        TestBlocksContext.Set("dev");
    }

    public void Dispose()
    {
        // Let index builds started by the requests finish before the databases are dropped, so they cannot
        // re-create them. These calls return the cached tasks and start no new work for databases already seen.
        foreach (var database in new[] { _fixture.Dev, _fixture.Other })
            MongoIndexEnsurer.EnsureAsync(database, "KeyTimelines", KeyTimelineRepository.OverviewIndexes, _logger.Object)
                .Wait(TimeSpan.FromSeconds(10));
        _fixture.Dispose();
        GC.SuppressFinalize(this);
    }

    private IMongoCollection<KeyTimeline> DevTimelines => _fixture.Dev.GetCollection<KeyTimeline>("KeyTimelines");

    private static KeyTimeline Entry(string itemId, string? operationId, string? logFrom, DateTime createDate, string? userId = null, string? value = null) => new()
    {
        ItemId = itemId,
        OperationId = operationId,
        LogFrom = logFrom,
        UserId = userId,
        CreateDate = createDate,
        EntityId = "key-" + itemId,
        CurrentData = new BlocksLanguageKey
        {
            ItemId = "key-" + itemId,
            KeyName = "key." + itemId,
            Resources = new[] { new Resource { Culture = "en-US", Value = value ?? itemId } }
        },
        PreviousData = new BlocksLanguageKey { ItemId = "key-" + itemId, KeyName = "key." + itemId }
    };

    /// <summary>Spec §7: op A has 3 entries (10:00-10:02, Published), op B one entry (10:05, KeyController.Save).</summary>
    private async Task SeedExampleAsync()
    {
        await DevTimelines.InsertManyAsync(new[]
        {
            Entry("a1", "A", LogFromConstants.Published, T0, "u1"),
            Entry("a2", "A", LogFromConstants.Published, T0.AddMinutes(1), "u1"),
            Entry("a3", "A", LogFromConstants.Published, T0.AddMinutes(2), "u1"),
            Entry("b1", "B", "KeyController.Save", T0.AddMinutes(5), "u2", "only-b")
        });
        await _fixture.Main.GetCollection<User>("Users").InsertManyAsync(new[]
        {
            new User { ItemId = "u1", FirstName = "Jane", LastName = "Doe" },
            new User { ItemId = "u2", Email = "u2@example.test" }
        });
    }

    [Fact]
    public async Task E1_Descending_GroupsCountsAndTakesTheNewestEntry()
    {
        await SeedExampleAsync();

        var result = await _repository.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(new[] { "B", "A" }, result.Operations.Select(o => o.OperationId));
        var b = result.Operations[0];
        Assert.Equal(1, b.AffectedKeysCount);
        Assert.Equal("KeyController.Save", b.LogFrom);
        Assert.Equal("u2@example.test", b.UserName);
        Assert.Equal("only-b", Assert.Single(b.CurrentData!.Resources).Value);
        Assert.Equal("key.b1", b.PreviousData!.KeyName);
        var a = result.Operations[1];
        Assert.Equal(3, a.AffectedKeysCount);
        Assert.Equal(T0.AddMinutes(2), a.CreateDate);
        Assert.Equal(DateTimeKind.Utc, a.CreateDate.Kind);
        Assert.Equal("Jane Doe", a.UserName);
        Assert.Equal("u1", a.UserId);
        Assert.Null(a.CurrentData);
        Assert.Null(a.PreviousData);
    }

    [Fact]
    public async Task E2_Ascending_TakesTheOldestEntryAndOrdersOldestFirst()
    {
        await SeedExampleAsync();

        var result = await _repository.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest { IsDescending = false });

        Assert.Equal(new[] { "A", "B" }, result.Operations.Select(o => o.OperationId));
        Assert.Equal(T0, result.Operations[0].CreateDate);
        Assert.Equal(3, result.Operations[0].AffectedKeysCount);
    }

    [Theory]
    [InlineData(1, 0, new string[0])]                   // E3: PageSize 0 -> total only
    [InlineData(1, -3, new string[0])]
    [InlineData(0, 1, new[] { "B" })]                   // E4: PageNumber 0 behaves like 1
    [InlineData(-2, 1, new[] { "B" })]
    [InlineData(2, 1, new[] { "A" })]
    [InlineData(int.MaxValue, 10, new string[0])]       // E5: no overflow
    [InlineData(int.MaxValue, int.MaxValue, new string[0])]
    public async Task E3_E4_E5_Paging_KeepsTheFormerQuirksWithoutOverflow(int pageNumber, int pageSize, string[] expected)
    {
        await SeedExampleAsync();

        var result = await _repository.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest { PageNumber = pageNumber, PageSize = pageSize });

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(expected, result.Operations.Select(o => o.OperationId));
    }

    [Fact]
    public async Task E6_NoEntries_ReturnsZero()
    {
        var result = await _repository.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

        Assert.Equal(0, result.TotalCount);
        Assert.Empty(result.Operations);
    }

    [Fact]
    public async Task E6_EntriesWithoutOperationId_AreExcludedFromGroupsAndTotal()
    {
        await DevTimelines.InsertManyAsync(new[]
        {
            Entry("n1", null, LogFromConstants.Published, T0),
            Entry("n2", "", LogFromConstants.Published, T0)
        });
        // A legacy document with no OperationId field at all.
        await _fixture.Dev.GetCollection<BsonDocument>("KeyTimelines").InsertOneAsync(new BsonDocument
        {
            { "_id", "legacy" }, { "LogFrom", LogFromConstants.Published }, { "CreateDate", T0 }
        });

        var result = await _repository.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

        Assert.Equal(0, result.TotalCount);
        Assert.Empty(result.Operations);
    }

    [Fact]
    public async Task MissingGroupFields_ReturnNull_AndUserNameKeepsTheFormerRule()
    {
        await DevTimelines.InsertManyAsync(new[]
        {
            Entry("m1", "no-user", null, T0),
            Entry("m2", "empty-user", LogFromConstants.Published, T0.AddMinutes(-1), ""),
            Entry("m3", "unknown-user", LogFromConstants.Published, T0.AddMinutes(-2), "not-in-users")
        });

        var result = await _repository.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

        Assert.Equal(new[] { "no-user", "empty-user", "unknown-user" }, result.Operations.Select(o => o.OperationId));
        Assert.Null(result.Operations[0].LogFrom);
        Assert.Null(result.Operations[0].UserId);
        Assert.Equal("Unknown", result.Operations[0].UserName);
        Assert.Equal("", result.Operations[1].UserName);
        Assert.Equal("not-in-users", result.Operations[2].UserName);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task PageWalk_CoversEveryOperationOnce_InCreateDateThenOperationIdOrder(bool isDescending)
    {
        // 23 operations on 6 distinct timestamps, so most pages cut through ties; op-07 and op-12 have 3 entries.
        var entries = new List<KeyTimeline>();
        var expectedDates = new Dictionary<string, DateTime>();
        for (var i = 0; i < 23; i++)
        {
            var op = $"op-{i:00}";
            var date = T0.AddMinutes(i % 6);
            var count = i is 7 or 12 ? 3 : 1;
            for (var e = 0; e < count; e++)
                entries.Add(Entry($"{op}-{e}", op, LogFromConstants.Published, date.AddSeconds(isDescending ? -e : e)));
            expectedDates[op] = date;
        }
        await DevTimelines.InsertManyAsync(entries);
        var expected = isDescending
            ? expectedDates.OrderByDescending(p => p.Value).ThenByDescending(p => p.Key, StringComparer.Ordinal).Select(p => p.Key)
            : expectedDates.OrderBy(p => p.Value).ThenBy(p => p.Key, StringComparer.Ordinal).Select(p => p.Key);

        var walked = new List<LocalizationTimelineEntry>();
        for (var page = 1; page <= 5; page++)
        {
            var result = await _repository.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest { PageNumber = page, PageSize = 5, IsDescending = isDescending });
            Assert.Equal(23, result.TotalCount);
            Assert.Equal(page < 5 ? 5 : 3, result.Operations.Count);
            walked.AddRange(result.Operations);
        }

        Assert.Equal(expected, walked.Select(o => o.OperationId));
        Assert.All(walked, o => Assert.Equal(expectedDates[o.OperationId], o.CreateDate));
        Assert.Equal(3, walked.Single(o => o.OperationId == "op-07").AffectedKeysCount);
        Assert.All(walked.Where(o => o.AffectedKeysCount == 1), o => Assert.NotNull(o.CurrentData));
    }

    [Fact]
    public async Task Filters_ApplyPerEntry_AndCountDistinctOperations()
    {
        await DevTimelines.InsertManyAsync(new[]
        {
            Entry("p1", "publish", LogFromConstants.Published, T0, "u1"),
            Entry("p2", "publish", LogFromConstants.Published, T0, "u1"),
            Entry("s1", "save", "KeyController.Save", T0.AddMinutes(1), "u1"),
            Entry("t1", "translate", "TranslateAll", T0.AddDays(-3), "u2"),
            Entry("r1", "rollback", "Rollback", T0.AddMinutes(2), "u2"),
            // One operation with mixed LogFrom: only its matching entries are counted.
            Entry("x1", "mixed", "TranslateAll", T0.AddMinutes(3), "u2"),
            Entry("x2", "mixed", "TranslateKey", T0.AddMinutes(3), "u2")
        });

        async Task<GetLocalizationTimelineResponse> Query(GetLocalizationTimelineRequest request) =>
            await _repository.GetLocalizationTimelineAsync(request);

        var portal = await Query(new GetLocalizationTimelineRequest { ExcludeLogFromValues = PortalExcludes });
        Assert.Equal(3, portal.TotalCount);
        Assert.Equal(new[] { "mixed", "publish", "translate" }, portal.Operations.Select(o => o.OperationId));
        Assert.Equal(1, portal.Operations[0].AffectedKeysCount);
        Assert.Equal("TranslateAll", portal.Operations[0].LogFrom);
        Assert.Equal(2, portal.Operations[1].AffectedKeysCount);

        Assert.Equal(5, (await Query(new GetLocalizationTimelineRequest())).TotalCount);
        Assert.Equal(2, (await Query(new GetLocalizationTimelineRequest { UserId = "u1" })).TotalCount);
        Assert.Equal(2, (await Query(new GetLocalizationTimelineRequest { LogFrom = "TranslateAll" })).TotalCount);
        Assert.Equal(new[] { "rollback", "save" },
            (await Query(new GetLocalizationTimelineRequest { LogFromValues = new List<string> { "Rollback", "KeyController.Save" } })).Operations.Select(o => o.OperationId));
        var range = await Query(new GetLocalizationTimelineRequest
        {
            CreateDateRange = new DateRange { StartDate = T0.AddMinutes(1), EndDate = T0.AddMinutes(2) }
        });
        Assert.Equal(new[] { "rollback", "save" }, range.Operations.Select(o => o.OperationId));
    }

    [Fact]
    public async Task OtherTenantsEntries_AreNeverReturned()
    {
        await DevTimelines.InsertOneAsync(Entry("d1", "dev-op", LogFromConstants.Published, T0));
        await _fixture.Other.GetCollection<KeyTimeline>("KeyTimelines").InsertOneAsync(Entry("o1", "other-op", LogFromConstants.Published, T0));

        var dev = await _repository.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());
        TestBlocksContext.Set("other");
        var other = await _repository.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

        Assert.Equal("dev-op", Assert.Single(dev.Operations).OperationId);
        Assert.Equal("other-op", Assert.Single(other.Operations).OperationId);
    }

    [Fact]
    public async Task FirstRequest_CreatesTheCreateDateIndex()
    {
        await SeedExampleAsync();

        await _repository.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

        // The request starts the creation in the background; poll for the index instead of awaiting the ensurer.
        BsonDocument? index = null;
        for (var attempt = 0; attempt < 100 && index == null; attempt++)
        {
            var indexes = await (await DevTimelines.Indexes.ListAsync()).ToListAsync();
            index = indexes.SingleOrDefault(i => i["name"] == "ix_CreateDate_desc");
            if (index == null) await Task.Delay(100);
        }
        Assert.NotNull(index);
        Assert.Equal(new BsonDocument("CreateDate", -1), index!["key"].AsBsonDocument);
        VerifyWarnings(Times.Never());
    }

    [Fact]
    public async Task ConflictingIndex_LogsOneWarning_AndTheOverviewStillAnswers()
    {
        await SeedExampleAsync();
        await DevTimelines.Indexes.CreateOneAsync(new CreateIndexModel<KeyTimeline>(
            Builders<KeyTimeline>.IndexKeys.Ascending(t => t.LastUpdateDate), new CreateIndexOptions { Name = "ix_CreateDate_desc" }));

        var warned = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _logger.Setup(l => l.Log(LogLevel.Warning, It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), It.IsAny<Exception?>(), It.IsAny<Func<It.IsAnyType, Exception?, string>>()))
            .Callback(() => warned.TrySetResult());

        var first = await _repository.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());
        await warned.Task.WaitAsync(TimeSpan.FromSeconds(10));
        var second = await _repository.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());
        // Cached task: waits for completion without a new attempt.
        await MongoIndexEnsurer.EnsureAsync(_fixture.Dev, "KeyTimelines", KeyTimelineRepository.OverviewIndexes, _logger.Object);

        Assert.Equal(2, first.TotalCount);
        Assert.Equal(2, second.TotalCount);
        VerifyWarnings(Times.Once());
    }

    private void VerifyWarnings(Times times) =>
        _logger.Verify(l => l.Log(
            LogLevel.Warning,
            It.IsAny<EventId>(),
            It.IsAny<It.IsAnyType>(),
            It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()), times);
}
