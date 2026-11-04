namespace Eurolm.DomainService.Services
{
    public class MigrateGlossariesResponse
    {
        public bool DryRun { get; set; }
        public int Total { get; set; }
        /// <summary>Documents converted (or that would be, on a dry run).</summary>
        public int Migrated { get; set; }
        public int AlreadyMigrated { get; set; }
        /// <summary>Ids with corrupt v1 JSON (migrated with defaults, note kept) or an unsupported version (left untouched).</summary>
        public List<string> Corrupt { get; set; } = new();
        /// <summary>Ids sharing a normalized name; any group blocks the unique index.</summary>
        public List<List<string>> DuplicateGroups { get; set; } = new();
        /// <summary>Key GlossaryIds entries that referenced no existing glossary (removed, or that would be).</summary>
        public long StaleKeyRefsRemoved { get; set; }
        /// <summary>Whether ux_normalizedname was created (on a dry run: whether it would be).</summary>
        public bool UniqueIndexCreated { get; set; }
        /// <summary>Why the unique index was not created, and other operator notes.</summary>
        public List<string> Notes { get; set; } = new();
    }
}
