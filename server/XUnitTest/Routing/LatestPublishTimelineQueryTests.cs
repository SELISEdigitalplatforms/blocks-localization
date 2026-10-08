using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Microsoft.Extensions.Configuration;
using MongoDB.Driver;
using Moq;

namespace XUnitTest.Routing;

/// <summary>Runs the latest-publish aggregation against local MongoDB, since mocks cannot validate the rendered pipeline.</summary>
public class LatestPublishTimelineQueryTests : IDisposable
{
    private readonly TenantPlacementFixture _fixture = new();
    public void Dispose() => _fixture.Dispose();

    private static KeyTimeline Timeline(string itemId, string entityId, string logFrom, DateTime createDate, string value) => new()
    {
        ItemId = itemId,
        EntityId = entityId,
        LogFrom = logFrom,
        CreateDate = createDate,
        CurrentData = new BlocksLanguageKey
        {
            ItemId = entityId,
            KeyName = "key." + entityId,
            Resources = new[] { new Resource { Culture = "en-US", Value = value } }
        },
        PreviousData = new BlocksLanguageKey { ItemId = entityId, KeyName = "key." + entityId }
    };

    [Fact]
    public async Task GetLatestPublishTimelinesAsync_ReturnsLatestPublishPerEntity_WithoutPreviousData()
    {
        var now = DateTime.UtcNow;
        await _fixture.Dev.GetCollection<KeyTimeline>("KeyTimelines").InsertManyAsync(new[]
        {
            Timeline("e1-old", "e1", LogFromConstants.Published, now.AddDays(-2), "old"),
            Timeline("e1-latest", "e1", LogFromConstants.Published, now.AddDays(-1), "latest"),
            Timeline("e1-newer-not-publish", "e1", LogFromConstants.PublishFailed, now, "failed"),
            Timeline("e2-only", "e2", LogFromConstants.Published, now.AddDays(-3), "e2"),
            Timeline("e3-not-requested", "e3", LogFromConstants.Published, now, "e3")
        });
        var repository = new KeyTimelineRepository(_fixture.Provider, Mock.Of<IConfiguration>());

        var result = await repository.GetLatestPublishTimelinesAsync(new List<string> { "e1", "e2", "missing" }, "dev");

        Assert.Equal(new[] { "e1", "e2" }, result.Keys.OrderBy(k => k));
        Assert.Equal("e1-latest", result["e1"].ItemId);
        Assert.Equal("latest", Assert.Single(result["e1"].CurrentData!.Resources).Value);
        Assert.Equal("e2-only", result["e2"].ItemId);
        Assert.All(result.Values, t => Assert.Null(t.PreviousData));
    }
}
