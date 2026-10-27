namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// Error codes returned by Key/Gets. Clients branch on these values, so they are part of the API contract.
    /// </summary>
    public static class KeyListErrorCodes
    {
        public const string InvalidPageSize = "INVALID_PAGE_SIZE";
        public const string InvalidPageNumber = "INVALID_PAGE_NUMBER";
        public const string InvalidSortProperty = "INVALID_SORT_PROPERTY";
        public const string InvalidCursor = "INVALID_CURSOR";
        public const string CursorMismatch = "CURSOR_MISMATCH";
        public const string SearchTextTooLong = "SEARCH_TEXT_TOO_LONG";
        public const string QueryTimeout = "QUERY_TIMEOUT";
    }

    /// <summary>
    /// Raised by the key list query for a request it cannot serve. The controller maps it to
    /// <see cref="StatusCode"/> with <see cref="ErrorCode"/> in the error body.
    /// </summary>
    public class KeyListException : Exception
    {
        public string ErrorCode { get; }
        public string Field { get; }
        public int StatusCode { get; }

        public KeyListException(string errorCode, string field, int statusCode = 400, Exception? inner = null)
            : base(errorCode, inner)
        {
            ErrorCode = errorCode;
            Field = field;
            StatusCode = statusCode;
        }
    }
}
