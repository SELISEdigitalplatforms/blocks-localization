using Eurolm.DomainService.Services;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// Opaque keyset position for Key/Gets: the last row's sort value and _id, plus a hash of the
    /// filter and sort it was issued for. It carries no tenant id; the database always comes from
    /// the caller's auth context, so a forged cursor can only move the start point inside the
    /// caller's own result set.
    /// </summary>
    public sealed class KeyListCursor
    {
        private const int Version = 1;

        public const string DefaultSortField = "KeyName";
        public static readonly IReadOnlyList<string> SortFields = new[] { "KeyName", "CreateDate", "LastUpdateDate" };

        public string SortField { get; private init; } = DefaultSortField;
        public bool IsDescending { get; private init; }
        public string FilterHash { get; private init; } = string.Empty;
        public string LastId { get; private init; } = string.Empty;
        private string? LastKeyName { get; init; }
        private DateTime LastDate { get; init; }

        /// <summary>
        /// Maps a requested sort property onto its stored field name. Blank means the default
        /// (KeyName); anything outside the whitelist returns null.
        /// </summary>
        public static string? ResolveSortField(string? requested)
        {
            if (string.IsNullOrWhiteSpace(requested)) return DefaultSortField;
            return SortFields.FirstOrDefault(f => string.Equals(f, requested.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        public static string ComputeFilterHash(FilterDefinition<Key> filter, string sortField, bool isDescending)
        {
            var registry = BsonSerializer.SerializerRegistry;
            var rendered = filter.Render(new RenderArgs<Key>(registry.GetSerializer<Key>(), registry)).ToString();
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{rendered}|{sortField}|{(isDescending ? "desc" : "asc")}"));
            return Convert.ToHexString(bytes, 0, 8).ToLowerInvariant();
        }

        public static string Encode(Key last, string sortField, bool isDescending, string filterHash)
        {
            var payload = new JsonObject
            {
                ["v"] = Version,
                ["s"] = sortField,
                ["d"] = isDescending,
                ["k"] = sortField == DefaultSortField
                    ? JsonValue.Create(last.KeyName)
                    : JsonValue.Create(ToUnixMilliseconds(GetDate(last, sortField))),
                ["id"] = last.ItemId,
                ["h"] = filterHash
            };
            return Base64Url.EncodeToString(Encoding.UTF8.GetBytes(payload.ToJsonString()));
        }

        /// <exception cref="KeyListException">INVALID_CURSOR when the token is not a version-1 cursor.</exception>
        public static KeyListCursor Decode(string token)
        {
            try
            {
                var node = JsonNode.Parse(Base64Url.DecodeFromChars(token))?.AsObject();
                if (node == null || node["v"]?.GetValue<int>() != Version) throw Invalid();

                var sortField = ResolveSortField(node["s"]?.GetValue<string>());
                var id = node["id"]?.GetValue<string>();
                var hash = node["h"]?.GetValue<string>();
                if (sortField == null || node["s"] == null || string.IsNullOrEmpty(id) || string.IsNullOrEmpty(hash)) throw Invalid();

                var k = node["k"];
                return new KeyListCursor
                {
                    SortField = sortField,
                    IsDescending = node["d"]?.GetValue<bool>() ?? throw Invalid(),
                    LastId = id,
                    FilterHash = hash,
                    LastKeyName = sortField == DefaultSortField ? k?.GetValue<string>() : null,
                    LastDate = sortField == DefaultSortField
                        ? default
                        : FromUnixMilliseconds(k?.GetValue<long>() ?? throw Invalid())
                };
            }
            catch (KeyListException)
            {
                throw;
            }
            catch (Exception ex) when (ex is FormatException or JsonException or InvalidOperationException or ArgumentException)
            {
                throw Invalid(ex);
            }
        }

        /// <summary>
        /// Rows strictly after this cursor in (sortField, _id) order, in the cursor's direction.
        /// </summary>
        public FilterDefinition<Key> AfterFilter()
        {
            if (SortField != DefaultSortField) return After(SortField, LastDate);

            // Only a key name can be null; dates are value types and always carry a value.
            return LastKeyName == null ? AfterNull(SortField) : After(SortField, LastKeyName);
        }

        private FilterDefinition<Key> IdAfter()
        {
            var f = Builders<Key>.Filter;
            return IsDescending ? f.Lt(k => k.ItemId, LastId) : f.Gt(k => k.ItemId, LastId);
        }

        private static FilterDefinition<Key> IsNull(string field) => new BsonDocument(field, BsonNull.Value);

        // MongoDB sorts null/missing before every other value. Comparison operators never match
        // null, so the null bucket is handled explicitly to keep the keyset gap-free.
        private FilterDefinition<Key> AfterNull(string field)
        {
            var f = Builders<Key>.Filter;
            var sameNull = f.And(IsNull(field), IdAfter());
            return IsDescending
                ? sameNull
                : f.Or(sameNull, new BsonDocument(field, new BsonDocument("$ne", BsonNull.Value)));
        }

        private FilterDefinition<Key> After<T>(string field, T value)
        {
            var f = Builders<Key>.Filter;
            var beyond = IsDescending ? f.Lt(field, value) : f.Gt(field, value);
            var same = f.And(f.Eq(field, value), IdAfter());
            return IsDescending ? f.Or(beyond, same, IsNull(field)) : f.Or(beyond, same);
        }

        private static DateTime GetDate(Key key, string sortField) =>
            sortField == "CreateDate" ? key.CreateDate : key.LastUpdateDate;

        // Values read from Mongo are UTC; Unspecified is treated as UTC rather than shifted by the host zone.
        private static long ToUnixMilliseconds(DateTime value) =>
            ((value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : value).Ticks - DateTime.UnixEpoch.Ticks)
            / TimeSpan.TicksPerMillisecond;

        private static DateTime FromUnixMilliseconds(long ms) =>
            DateTime.UnixEpoch.AddTicks(ms * TimeSpan.TicksPerMillisecond);

        private static KeyListException Invalid(Exception? inner = null) =>
            new(KeyListErrorCodes.InvalidCursor, nameof(GetKeysRequest.Cursor), 400, inner);
    }
}
