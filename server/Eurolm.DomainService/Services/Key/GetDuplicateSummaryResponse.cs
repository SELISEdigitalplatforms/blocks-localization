namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// Duplicate counts for the current tenant. A key group is two or more keys with the same
    /// ModuleId and KeyName; a module group is two or more modules with the same ModuleName.
    /// </summary>
    public class GetDuplicateSummaryResponse
    {
        public long KeyGroupCount { get; set; }
        public long DuplicateKeyRowCount { get; set; }
        public long ExtraKeyCount { get; set; }
        public long ModuleGroupCount { get; set; }
        public long ExtraModuleCount { get; set; }
        public bool KeyUniquenessEnforced { get; set; }
        public bool ModuleUniquenessEnforced { get; set; }
    }
}
