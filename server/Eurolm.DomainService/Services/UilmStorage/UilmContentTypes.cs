namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>One module/language whose served row may still need a Storage file (backfill candidate).</summary>
    public sealed record UilmFileGroup(string ModuleName, string Language);

    /// <summary>
    /// A tenant's <c>UilmFiles</c> rows by state: without a file in the tenant's ledger (legacy or copied rows), and
    /// pointer rows with a ledger file that still carry <c>Content</c> or no longer do.
    /// </summary>
    public sealed record UilmFileCounts(long LegacyRows, long PointersWithContent, long PointersWithoutContent);
}
