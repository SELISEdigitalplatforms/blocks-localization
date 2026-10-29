using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetGlossariesRequest 
    {
        public string? SearchText { get; set; }
        public int PageNumber { get; set; } = 0;
        public int PageSize { get; set; } = 20;
        public bool? IsGlobal { get; set; }
        public string? ModuleId { get; set; }

        /// <summary>"translate" | "keep" | "forbidden"; structured (migrated) documents only.</summary>
        public string? Rule { get; set; }

        /// <summary>"draft" | "approved" | "deprecated"; approved also matches documents without a stored status.</summary>
        public string? Status { get; set; }

        /// <summary>Culture code: translate terms without a translation for it; structured (migrated) documents only.</summary>
        public string? MissingTranslation { get; set; }

        /// <summary>Culture code; the glossary's own Language equals it.</summary>
        public string? Language { get; set; }

        /// <summary>The glossary's Type equals it, ignoring case.</summary>
        public string? Type { get; set; }

        /// <summary>"project" (whole project: IsGlobal) | "modules" (not global, linked to at least one module).</summary>
        public string? Scope { get; set; }

        /// <summary>"name" | "createDate" | "lastUpdateDate"; default createDate. Ties are broken by ItemId.</summary>
        public string? SortBy { get; set; }

        /// <summary>Default true for the dates and false for name.</summary>
        public bool? SortDescending { get; set; }
    }
}
