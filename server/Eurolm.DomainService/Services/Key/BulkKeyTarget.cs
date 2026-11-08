using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// Limits and error codes shared by Key/DeleteKeys and Key/TranslateKeys. Clients branch on the
    /// codes, so they are part of the API contract.
    /// </summary>
    public static class BulkKeyTarget
    {
        public const int MaxKeys = 10_000;
        public const int DeleteBatchSize = 500;
        public const int TranslateEventBatchSize = 1_000;

        /// <summary>The Errors key that carries the target error code.</summary>
        public const string Field = "Target";

        /// <summary>
        /// The Errors key that repeats <see cref="BulkKeyActionResponse.MatchedCount"/>. HTTP clients that keep
        /// only the Errors map of a failed response still get the count.
        /// </summary>
        public const string MatchedCountField = "MatchedCount";

        public const string TooManyKeys = "TOO_MANY_KEYS";
        public const string KeySetChanged = "KEY_SET_CHANGED";
        public const string TargetRequiredMessage = "Provide either ItemIds or Filter.";
    }

    public class BulkKeyActionResponse : BaseMutationResponse
    {
        /// <summary>The number of keys the request resolved to, when it was resolved.</summary>
        public long? MatchedCount { get; set; }
    }

    /// <summary>
    /// Raised when a filter-form target can't be acted on. The controller maps it to <see cref="StatusCode"/>.
    /// </summary>
    public class BulkKeyTargetException : Exception
    {
        public string ErrorCode { get; }
        public int StatusCode { get; }
        public long MatchedCount { get; }

        public BulkKeyTargetException(string errorCode, int statusCode, long matchedCount)
            : base(errorCode)
        {
            ErrorCode = errorCode;
            StatusCode = statusCode;
            MatchedCount = matchedCount;
        }

        public BulkKeyActionResponse ToResponse() => new()
        {
            IsSuccess = false,
            MatchedCount = MatchedCount,
            Errors = new Dictionary<string, string>
            {
                [BulkKeyTarget.Field] = ErrorCode,
                [BulkKeyTarget.MatchedCountField] = MatchedCount.ToString(System.Globalization.CultureInfo.InvariantCulture)
            }
        };
    }
}
