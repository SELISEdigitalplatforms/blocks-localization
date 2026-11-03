namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// Outcome of creating the unique indexes for a tenant. A collection that still has
    /// duplicates, or whose index could not be built, reports false.
    /// </summary>
    public class EnforceUniquenessResponse
    {
        public bool KeyUniquenessEnforced { get; set; }
        public bool ModuleUniquenessEnforced { get; set; }
        public long KeyGroupCount { get; set; }
        public long ModuleGroupCount { get; set; }
    }
}
