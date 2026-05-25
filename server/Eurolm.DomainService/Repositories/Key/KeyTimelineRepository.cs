using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Entities;
using Microsoft.Extensions.Configuration;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Eurolm.DomainService.Repositories
{
    public class KeyTimelineRepository : IKeyTimelineRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private readonly IConfiguration _configuration;
        private const string _collectionName = "KeyTimelines";

        public KeyTimelineRepository(IDbContextProvider dbContextProvider, IConfiguration configuration)
        {
            _dbContextProvider = dbContextProvider;
            _configuration = configuration;
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
            var sort = query.IsDescending
                ? Builders<KeyTimeline>.Sort.Descending(t => t.CreateDate)
                : Builders<KeyTimeline>.Sort.Ascending(t => t.CreateDate);

            // Fetch matching timeline entries sorted by CreateDate
            var timelines = await collection
                .Find(filter)
                .Sort(sort)
                .ToListAsync();

            // Group by OperationId — the sort above ensures $first semantics via LINQ's First()
            var grouped = timelines
                .GroupBy(t => t.OperationId)
                .Select(g =>
                {
                    var first = g.First();
                    var count = g.Count();
                    return new LocalizationTimelineEntry
                    {
                        OperationId = g.Key!,
                        LogFrom = first.LogFrom,
                        UserId = first.UserId,
                        CreateDate = first.CreateDate,
                        AffectedKeysCount = count,
                        CurrentData = count == 1 ? first.CurrentData : null,
                        PreviousData = count == 1 ? first.PreviousData : null
                    };
                });

            var sortedGrouped = query.IsDescending
                ? grouped.OrderByDescending(x => x.CreateDate).ToList()
                : grouped.OrderBy(x => x.CreateDate).ToList();

            var totalCount = sortedGrouped.Count;
            var skip = (query.PageNumber - 1) * query.PageSize;
            var pagedData = sortedGrouped.Skip(skip).Take(query.PageSize).ToList();

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

            var timelines = await collection
                .Find(filter)
                .Sort(Builders<KeyTimeline>.Sort.Descending(t => t.CreateDate))
                .ToListAsync();

            // Group by EntityId, take latest (first after descending sort) for each
            return timelines
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
