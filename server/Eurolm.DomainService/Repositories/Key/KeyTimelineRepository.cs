using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Eurolm.DomainService.Repositories
{
    public class KeyTimelineRepository : IKeyTimelineRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private readonly IConfiguration _configuration;
        private readonly ILogger<KeyTimelineRepository> _logger;
        private const string _collectionName = "KeyTimelines";
        // Field names of the overview aggregation's $group and $facet output.
        private const string FirstItemIdField = "FirstItemId";
        private const string CountField = "Count";
        private const string TotalField = "Total";
        private const string DataField = "Data";

        /// <summary>
        /// The largest overview page; a larger PageSize is clamped to it. The page and the total come back in one
        /// $facet document, which must stay under MongoDB's 16 MB document limit.
        /// </summary>
        public const int MaxOverviewPageSize = 1000;

        /// <summary>Supports the overview's $sort on CreateDate before grouping.</summary>
        public static IReadOnlyList<CreateIndexModel<KeyTimeline>> OverviewIndexes { get; } = new[]
        {
            new CreateIndexModel<KeyTimeline>(
                Builders<KeyTimeline>.IndexKeys.Descending(t => t.CreateDate),
                new CreateIndexOptions { Name = "ix_CreateDate_desc" })
        };

        public KeyTimelineRepository(IDbContextProvider dbContextProvider, IConfiguration configuration, ILogger<KeyTimelineRepository> logger)
        {
            _dbContextProvider = dbContextProvider;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<GetKeyTimelineQueryResponse> GetKeyTimelineAsync(GetKeyTimelineRequest query)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<KeyTimeline>(_collectionName);

            var filter = GetTimelineFilter(query);
            var sort = !string.IsNullOrWhiteSpace(query.SortProperty) && query.IsDescending 
                ? Builders<KeyTimeline>.Sort.Descending(query.SortProperty) 
                : Builders<KeyTimeline>.Sort.Ascending(query.SortProperty ?? "CreateDate");

            var totalCount = await collection.CountDocumentsAsync(filter);
            
            var timelines = await collection
                .Find(filter)
                .Sort(sort)
                .Skip((query.PageNumber - 1) * query.PageSize)
                .Limit(query.PageSize)
                .ToListAsync();

            // Get unique user IDs from timelines
            var uniqueUserIds = timelines
                .Where(t => !string.IsNullOrEmpty(t.UserId))
                .Select(t => t.UserId)
                .Distinct()
                .ToList();

            // Fetch user information if there are any user IDs
            Dictionary<string, User> userLookup = new Dictionary<string, User>();
            if (uniqueUserIds.Any())
            {
                var rootTenantId = _configuration["RootTenantId"];
                var rootDB = _dbContextProvider.GetDatabase(rootTenantId);
                var usersCollection = rootDB.GetCollection<User>("Users");
                var userFilter = Builders<User>.Filter.In(u => u.ItemId, uniqueUserIds);
                var users = await usersCollection.Find(userFilter).ToListAsync();

                userLookup = users.ToDictionary(u => u.ItemId, u => u);
            }

            // Populate UserName property for each timeline
            foreach (var timeline in timelines)
            {
                if (!string.IsNullOrEmpty(timeline.UserId) && userLookup.TryGetValue(timeline.UserId, out var user))
                {
                    // Use FirstName + LastName if available, otherwise use Email
                    if (!string.IsNullOrEmpty(user.FirstName) || !string.IsNullOrEmpty(user.LastName))
                    {
                        var firstName = user.FirstName ?? "";
                        var lastName = user.LastName ?? "";
                        timeline.UserName = $"{firstName} {lastName}".Trim();
                    }
                    else if (!string.IsNullOrEmpty(user.Email))
                    {
                        timeline.UserName = user.Email;
                    }
                    else
                    {
                        timeline.UserName = timeline.UserId; // Fallback to UserId
                    }
                }
                else
                {
                    timeline.UserName = timeline.UserId ?? "Unknown"; // Fallback
                }
            }

            return new GetKeyTimelineQueryResponse
            {
                TotalCount = totalCount,
                Timelines = timelines
            };
        }

        public async Task SaveKeyTimelineAsync(KeyTimeline timeline)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<KeyTimeline>(_collectionName);

            if (string.IsNullOrEmpty(timeline.ItemId))
            {
                timeline.ItemId = Guid.NewGuid().ToString();
                timeline.CreateDate = DateTime.Now;
                timeline.LastUpdateDate = DateTime.Now;
                await collection.InsertOneAsync(timeline);
            }
            else
            {
                timeline.LastUpdateDate = DateTime.Now;
                var filter = Builders<KeyTimeline>.Filter.Eq(t => t.ItemId, timeline.ItemId);
                await collection.ReplaceOneAsync(filter, timeline, new ReplaceOptions { IsUpsert = true });
            }
        }

        public async Task BulkSaveKeyTimelinesAsync(List<KeyTimeline> timelines, string targetedProjectKey)
        {
            if (!timelines.Any()) return;

            var dataBase = _dbContextProvider.GetDatabase(targetedProjectKey);
            var collection = dataBase.GetCollection<KeyTimeline>(_collectionName);

            // Prepare timelines for bulk insert
            var now = DateTime.UtcNow;
            foreach (var timeline in timelines)
            {
                if (string.IsNullOrEmpty(timeline.ItemId))
                {
                    timeline.ItemId = Guid.NewGuid().ToString();
                }
                timeline.CreateDate = now;
                timeline.LastUpdateDate = now;
            }

            // Use InsertManyAsync for bulk insertion
            await collection.InsertManyAsync(timelines);
        }

        public async Task<KeyTimeline?> GetTimelineByItemIdAsync(string itemId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<KeyTimeline>(_collectionName);

            var filter = Builders<KeyTimeline>.Filter.Eq(t => t.ItemId, itemId);

            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        private static FilterDefinition<KeyTimeline> GetTimelineFilter(GetKeyTimelineRequest request)
        {
            var builder = Builders<KeyTimeline>.Filter;
            var filters = new List<FilterDefinition<KeyTimeline>>();

            // Filter by EntityId (Key ItemId)
            if (!string.IsNullOrWhiteSpace(request.EntityId))
            {
                filters.Add(builder.Eq(t => t.EntityId, request.EntityId));
            }

            // Filter by UserId
            if (!string.IsNullOrWhiteSpace(request.UserId))
            {
                filters.Add(builder.Eq(t => t.UserId, request.UserId));
            }

            // Filter by CreateDate range
            if (request.CreateDateRange != null)
            {
                if (request.CreateDateRange.StartDate.HasValue)
                {
                    filters.Add(builder.Gte(t => t.CreateDate, request.CreateDateRange.StartDate.Value));
                }
                if (request.CreateDateRange.EndDate.HasValue)
                {
                    filters.Add(builder.Lte(t => t.CreateDate, request.CreateDateRange.EndDate.Value));
                }
            }

            return filters.Count > 0 ? builder.And(filters) : builder.Empty;
        }

        public async Task<GetLocalizationTimelineResponse> GetLocalizationTimelineAsync(GetLocalizationTimelineRequest query)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<KeyTimeline>(_collectionName);
            // Not awaited: the first request on a large tenant must not wait for the index build.
            _ = MongoIndexEnsurer.EnsureAsync(dataBase, _collectionName, OverviewIndexes, _logger);

            // Build strongly-typed filters — always exclude entries without an OperationId (legacy data)
            var filterBuilder = Builders<KeyTimeline>.Filter;
            var filters = new List<FilterDefinition<KeyTimeline>>
            {
                filterBuilder.Ne(t => t.OperationId, null),
                filterBuilder.Ne(t => t.OperationId, "")
            };
            if (!string.IsNullOrWhiteSpace(query.UserId))
            {
                filters.Add(filterBuilder.Eq(t => t.UserId, query.UserId));
            }

            if (!string.IsNullOrWhiteSpace(query.LogFrom))
            {
                filters.Add(filterBuilder.Eq(t => t.LogFrom, query.LogFrom));
            }

            if (query.LogFromValues != null && query.LogFromValues.Any())
            {
                filters.Add(filterBuilder.In(t => t.LogFrom, query.LogFromValues));
            }

            if (query.ExcludeLogFromValues != null && query.ExcludeLogFromValues.Any())
            {
                filters.Add(filterBuilder.Nin(t => t.LogFrom, query.ExcludeLogFromValues));
            }

            if (query.CreateDateRange != null)
            {
                if (query.CreateDateRange.StartDate.HasValue)
                {
                    filters.Add(filterBuilder.Gte(t => t.CreateDate, query.CreateDateRange.StartDate.Value));
                }
                if (query.CreateDateRange.EndDate.HasValue)
                {
                    filters.Add(filterBuilder.Lte(t => t.CreateDate, query.CreateDateRange.EndDate.Value));
                }
            }

            var filter = filterBuilder.And(filters);
            var (totalCount, groups) = await GetOperationPageAsync(collection, filter, query);
            await PopulateSingleEntrySnapshotsAsync(collection, groups);
            var pagedData = groups.Select(g => g.Entry).ToList();

            // Populate user names
            var uniqueUserIds = pagedData
                .Where(x => !string.IsNullOrEmpty(x.UserId))
                .Select(x => x.UserId)
                .Distinct()
                .ToList();

            var userLookup = await GetUserLookupAsync(uniqueUserIds);

            foreach (var op in pagedData)
            {
                var userId = op.UserId;
                if (!string.IsNullOrEmpty(userId) && userLookup.TryGetValue(userId, out var user))
                {
                    if (!string.IsNullOrEmpty(user.FirstName) || !string.IsNullOrEmpty(user.LastName))
                    {
                        op.UserName = $"{user.FirstName ?? ""} {user.LastName ?? ""}".Trim();
                    }
                    else if (!string.IsNullOrEmpty(user.Email))
                    {
                        op.UserName = user.Email;
                    }
                    else
                    {
                        op.UserName = userId;
                    }
                }
                else
                {
                    op.UserName = userId ?? "Unknown";
                }
            }

            return new GetLocalizationTimelineResponse
            {
                TotalCount = totalCount,
                Operations = pagedData
            };
        }

        /// <summary>An operation summary from the aggregation, with the ItemId of its first entry.</summary>
        private sealed record OperationGroup(LocalizationTimelineEntry Entry, string? FirstItemId);

        /// <summary>
        /// Groups the matching entries by OperationId, counts the groups and cuts the requested page in MongoDB,
        /// so only the page's group summaries (no snapshots) reach application memory.
        /// </summary>
        private static async Task<(long TotalCount, List<OperationGroup> Page)> GetOperationPageAsync(
            IMongoCollection<KeyTimeline> collection,
            FilterDefinition<KeyTimeline> filter,
            GetLocalizationTimelineRequest query)
        {
            var direction = query.IsDescending ? -1 : 1;
            var group = new BsonDocument
            {
                { "_id", "$" + nameof(KeyTimeline.OperationId) },
                { nameof(KeyTimeline.LogFrom), new BsonDocument("$first", "$" + nameof(KeyTimeline.LogFrom)) },
                { nameof(KeyTimeline.UserId), new BsonDocument("$first", "$" + nameof(KeyTimeline.UserId)) },
                { nameof(KeyTimeline.CreateDate), new BsonDocument("$first", "$" + nameof(KeyTimeline.CreateDate)) },
                { FirstItemIdField, new BsonDocument("$first", "$_id") },
                { CountField, new BsonDocument("$sum", 1) }
            };

            // PageNumber <= 0 is page 1 and PageSize <= 0 returns the total only (MongoDB rejects $limit: 0), as
            // with the former in-memory Skip/Take. Unlike before, the skip is a long, so large page numbers don't overflow.
            // A PageSize above MaxOverviewPageSize pages as if it were MaxOverviewPageSize.
            var facet = new BsonDocument(TotalField, new BsonArray { new BsonDocument("$count", CountField) });
            if (query.PageSize > 0)
            {
                var pageSize = Math.Min(query.PageSize, MaxOverviewPageSize);
                var skip = Math.Max(query.PageNumber - 1L, 0L) * pageSize;
                facet.Add(DataField, new BsonArray
                {
                    new BsonDocument("$skip", skip),
                    new BsonDocument("$limit", pageSize)
                });
            }

            // The first $sort makes $first pick the newest (or oldest) entry of each group; the second orders
            // the groups, with ties broken by OperationId so consecutive pages neither repeat nor skip one.
            var results = await collection
                .Aggregate(new AggregateOptions { AllowDiskUse = true })
                .Match(filter)
                .Sort(new BsonDocument(nameof(KeyTimeline.CreateDate), direction))
                .Group(group)
                .Sort(new BsonDocument { { nameof(KeyTimeline.CreateDate), direction }, { "_id", direction } })
                .AppendStage<BsonDocument>(new BsonDocument("$facet", facet))
                .ToListAsync();

            var result = results.FirstOrDefault();
            var totalCount = result?.GetValue(TotalField, BsonNull.Value) is BsonArray { Count: > 0 } total
                ? total[0].AsBsonDocument.GetValue(CountField, 0).ToInt64()
                : 0;
            var page = result?.GetValue(DataField, BsonNull.Value) is BsonArray data
                ? data.OfType<BsonDocument>().Select(ToOperationGroup).ToList()
                : new List<OperationGroup>();
            return (totalCount, page);
        }

        private static OperationGroup ToOperationGroup(BsonDocument group) => new(
            new LocalizationTimelineEntry
            {
                OperationId = StringOrNull(group, "_id") ?? string.Empty,
                LogFrom = StringOrNull(group, nameof(KeyTimeline.LogFrom)),
                UserId = StringOrNull(group, nameof(KeyTimeline.UserId)),
                CreateDate = group.GetValue(nameof(KeyTimeline.CreateDate), BsonNull.Value) is BsonDateTime createDate
                    ? createDate.ToUniversalTime()
                    : default,
                AffectedKeysCount = group.GetValue(CountField, 0).ToInt32()
            },
            StringOrNull(group, FirstItemIdField));

        private static string? StringOrNull(BsonDocument document, string name) =>
            document.GetValue(name, BsonNull.Value) is BsonString value ? value.Value : null;

        /// <summary>
        /// Loads CurrentData/PreviousData only for the page's single-entry operations. An entry deleted since the
        /// aggregation leaves both null. No query runs when the page has no single-entry operation.
        /// </summary>
        private static async Task PopulateSingleEntrySnapshotsAsync(IMongoCollection<KeyTimeline> collection, List<OperationGroup> page)
        {
            var singleEntryGroups = page
                .Where(g => g.Entry.AffectedKeysCount == 1 && !string.IsNullOrEmpty(g.FirstItemId))
                .ToList();
            if (singleEntryGroups.Count == 0) return;

            var entries = await collection
                .Find(Builders<KeyTimeline>.Filter.In(t => t.ItemId, singleEntryGroups.Select(g => g.FirstItemId!)))
                .ToListAsync();
            var entriesById = entries.ToDictionary(t => t.ItemId);

            foreach (var group in singleEntryGroups.Where(g => entriesById.ContainsKey(g.FirstItemId!)))
            {
                var entry = entriesById[group.FirstItemId!];
                group.Entry.CurrentData = entry.CurrentData;
                group.Entry.PreviousData = entry.PreviousData;
            }
        }

        public async Task<GetKeyTimelineQueryResponse> GetTimelineByOperationIdAsync(GetTimelineByOperationIdRequest query)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<KeyTimeline>(_collectionName);

            var filter = Builders<KeyTimeline>.Filter.Eq(t => t.OperationId, query.OperationId);
            var sort = Builders<KeyTimeline>.Sort.Descending(t => t.CreateDate);

            var totalCount = await collection.CountDocumentsAsync(filter);

            var timelines = await collection
                .Find(filter)
                .Sort(sort)
                .Skip((query.PageNumber - 1) * query.PageSize)
                .Limit(query.PageSize)
                .ToListAsync();

            // Populate user names
            var uniqueUserIds = timelines
                .Where(t => !string.IsNullOrEmpty(t.UserId))
                .Select(t => t.UserId)
                .Distinct()
                .ToList();

            var userLookup = await GetUserLookupAsync(uniqueUserIds);

            foreach (var timeline in timelines)
            {
                if (!string.IsNullOrEmpty(timeline.UserId) && userLookup.TryGetValue(timeline.UserId, out var user))
                {
                    if (!string.IsNullOrEmpty(user.FirstName) || !string.IsNullOrEmpty(user.LastName))
                    {
                        timeline.UserName = $"{user.FirstName ?? ""} {user.LastName ?? ""}".Trim();
                    }
                    else if (!string.IsNullOrEmpty(user.Email))
                    {
                        timeline.UserName = user.Email;
                    }
                    else
                    {
                        timeline.UserName = timeline.UserId;
                    }
                }
                else
                {
                    timeline.UserName = timeline.UserId ?? "Unknown";
                }
            }

            return new GetKeyTimelineQueryResponse
            {
                TotalCount = totalCount,
                Timelines = timelines
            };
        }

        public async Task<Dictionary<string, KeyTimeline>> GetLatestPublishTimelinesAsync(List<string> entityIds, string targetedProjectKey)
        {
            if (!entityIds.Any()) return new Dictionary<string, KeyTimeline>();

            var dataBase = _dbContextProvider.GetDatabase(targetedProjectKey);
            var collection = dataBase.GetCollection<KeyTimeline>(_collectionName);

            var filter = Builders<KeyTimeline>.Filter.And(
                Builders<KeyTimeline>.Filter.In(t => t.EntityId, entityIds),
                Builders<KeyTimeline>.Filter.Eq(t => t.LogFrom, LogFromConstants.Published)
            );

            // Pick the latest publish per entity on the server. Loading every historical publish entry
            // (keys x publishes, each with full resource snapshots) exhausted worker memory.
            // PreviousData is dropped because callers only compare against CurrentData.
            var timelines = await collection
                .Aggregate(new AggregateOptions { AllowDiskUse = true })
                .Match(filter)
                .Project<KeyTimeline>(Builders<KeyTimeline>.Projection.Exclude(t => t.PreviousData))
                .Sort(Builders<KeyTimeline>.Sort.Ascending(t => t.EntityId).Descending(t => t.CreateDate))
                .Group(t => t.EntityId, g => g.First())
                .ToListAsync();

            return timelines
                .Where(t => t.EntityId != null)
                .GroupBy(t => t.EntityId!)
                .ToDictionary(g => g.Key, g => g.First());
        }


        private async Task<Dictionary<string, User>> GetUserLookupAsync(List<string?> userIds)
        {
            var validUserIds = userIds.Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList();
            if (!validUserIds.Any()) return new Dictionary<string, User>();

            var rootTenantId = _configuration["RootTenantId"];
            var rootDB = _dbContextProvider.GetDatabase(rootTenantId);
            var usersCollection = rootDB.GetCollection<User>("Users");
            var userFilter = Builders<User>.Filter.In(u => u.ItemId, validUserIds);
            var users = await usersCollection.Find(userFilter).ToListAsync();

            return users.ToDictionary(u => u.ItemId, u => u);
        }
    }
}
