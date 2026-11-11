namespace Eurolm.DomainService.Repositories.UilmStorage
{
    /// <summary>The tenant's publish version counter (<c>UilmPublishCounters</c>).</summary>
    public interface IUilmPublishCounterRepository
    {
        /// <summary>
        /// Atomically sets the counter to <c>max(current, seed) + 1</c> (creating it when missing) and returns it. The seed
        /// is the project's highest history version, so numbering continues from today's history.
        /// </summary>
        Task<int> NextVersionAsync(string projectKey);
    }
}
