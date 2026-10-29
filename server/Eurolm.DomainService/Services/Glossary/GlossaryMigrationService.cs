using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Microsoft.Extensions.Logging;

namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// Per-tenant, idempotent migration of the Track A terminology (v1 JSON in AdditionalNote, rule marker in
    /// Context) into the structured fields (DATA CONTRACTS › Migration). Run with dryRun=false only after the
    /// Phase 7 frontend is deployed: the Track A UI reads terminology only from additionalNote.
    /// </summary>
    public class GlossaryMigrationService : IGlossaryMigrationService
    {
        public const int BatchSize = 200;

        private readonly IGlossaryRepository _glossaryRepository;
        private readonly IKeyRepository _keyRepository;
        private readonly ILogger<GlossaryMigrationService> _logger;
        private readonly IGlossaryMatcherCache? _matcherCache;
        private readonly IGlossaryRecheckService? _recheckService;

        public GlossaryMigrationService(IGlossaryRepository glossaryRepository,
                                        IKeyRepository keyRepository,
                                        ILogger<GlossaryMigrationService> logger,
                                        IGlossaryMatcherCache? matcherCache = null,
                                        IGlossaryRecheckService? recheckService = null)
        {
            _glossaryRepository = glossaryRepository;
            _keyRepository = keyRepository;
            _logger = logger;
            _matcherCache = matcherCache;
            _recheckService = recheckService;
        }

        public async Task<MigrateGlossariesResponse> MigrateAsync(bool dryRun)
        {
            var tenantId = BlocksContext.GetContext()?.TenantId
                ?? throw new InvalidOperationException("A tenant context is required to migrate glossaries.");

            var all = await _glossaryRepository.GetAllEntitiesAsync(tenantId);
            var report = new MigrateGlossariesResponse { DryRun = dryRun, Total = all.Count };
            var writes = new List<(BlocksGlossary Glossary, int ExpectedVersion)>();
            var leftLegacy = 0;

            foreach (var glossary in all)
            {
                var outcome = Plan(glossary);
                if (outcome.Corrupt) report.Corrupt.Add(glossary.ItemId);
                if (outcome.Updated != null) writes.Add((outcome.Updated, glossary.Version));
                else if (glossary.SchemaVersion < 2) leftLegacy++;
                else report.AlreadyMigrated++;
            }

            // Group by the name each document will have after the migration.
            report.DuplicateGroups = all
                .GroupBy(g => g.NormalizedName ?? GlossaryMapper.NormalizedName(g.Name), StringComparer.Ordinal)
                .Where(group => group.Count() > 1)
                .Select(group => group.Select(g => g.ItemId).OrderBy(id => id, StringComparer.Ordinal).ToList())
                .ToList();

            report.StaleKeyRefsRemoved = await _keyRepository.RemoveStaleGlossaryIdsAsync(
                all.Select(g => g.ItemId).ToHashSet(StringComparer.Ordinal), dryRun, BatchSize);

            var migrated = writes.Count;
            if (!dryRun)
            {
                long modified = 0;
                foreach (var batch in writes.Chunk(BatchSize))
                {
                    modified += await _glossaryRepository.ReplaceManyAsync(batch);
                }
                if (modified < writes.Count)
                {
                    // A document changed between the read and the write; it is picked up by the next run.
                    leftLegacy += (int)(writes.Count - modified);
                    report.Notes.Add($"{writes.Count - modified} glossaries changed during the migration and were skipped; run it again.");
                }
                migrated = (int)modified;
            }
            report.Migrated = migrated;

            var canCreateIndex = report.DuplicateGroups.Count == 0 && leftLegacy == 0;
            if (report.DuplicateGroups.Count > 0)
                report.Notes.Add("Duplicate normalized names block the unique index; rename or delete them and run again.");
            if (leftLegacy > 0)
                report.Notes.Add("Glossaries that are not yet migrated (for example an unsupported terminology version) block the unique index; fix or delete them and run again.");

            if (canCreateIndex && !dryRun)
            {
                await _glossaryRepository.CreateNormalizedNameUniqueIndexAsync();
            }
            report.UniqueIndexCreated = canCreateIndex;

            if (!dryRun && migrated > 0)
            {
                _matcherCache?.Invalidate(tenantId);
                // Every term may have changed, so the whole project is re-checked (flag on only).
                if (_recheckService != null) await _recheckService.TriggerAsync(Array.Empty<string>());
            }

            _logger.LogInformation(
                "Glossary migration {Mode}: total {Total}, migrated {Migrated}, already {AlreadyMigrated}, corrupt {Corrupt}, duplicate groups {DuplicateGroups}, stale key refs {StaleKeyRefs}, unique index {UniqueIndex}",
                dryRun ? "dry run" : "run", report.Total, report.Migrated, report.AlreadyMigrated, report.Corrupt.Count,
                report.DuplicateGroups.Count, report.StaleKeyRefsRemoved, report.UniqueIndexCreated);

            return report;
        }

        private sealed record PlanOutcome(BlocksGlossary? Updated, bool Corrupt);

        /// <summary>What the migration writes for one document (null when it leaves the document as is).</summary>
        private static PlanOutcome Plan(BlocksGlossary glossary)
        {
            var parsed = GlossaryMetaParser.Parse(glossary.AdditionalNote);
            var hasJson = parsed.Status == GlossaryMetaStatus.Structured;
            var hasMarker = RuleMarker.HasTrailingMarker(glossary.Context);

            if (glossary.SchemaVersion >= 2)
            {
                // Structured fields were kept in sync by Track A saves (A12); only clean the two text fields.
                // A corrupt or unsupported note can't be cleaned, so it alone never causes a write (idempotent).
                var corrupt = parsed.Status is GlossaryMetaStatus.Corrupt or GlossaryMetaStatus.UnsupportedVersion;
                if (!hasJson && !hasMarker) return new PlanOutcome(null, corrupt);

                var cleaned = Clone(glossary);
                cleaned.Context = RuleMarker.Strip(glossary.Context);
                if (hasJson) cleaned.AdditionalNote = parsed.Meta.Note ?? "";
                cleaned.NormalizedName = GlossaryMapper.NormalizedName(glossary.Name);
                cleaned.Version = glossary.Version + 1;
                return new PlanOutcome(cleaned, corrupt);
            }

            if (parsed.Status == GlossaryMetaStatus.UnsupportedVersion)
            {
                // Left untouched; it keeps SchemaVersion < 2 and therefore blocks the unique index.
                return new PlanOutcome(null, true);
            }

            var effective = GlossaryTerminologyResolver.Resolve(glossary);
            var migrated = Clone(glossary);
            migrated.Rule = effective.Rule;
            migrated.CaseSensitive = effective.CaseSensitive;
            migrated.Variants = effective.Variants;
            migrated.Translations = effective.Translations;
            migrated.Status = glossary.Status ?? GlossaryStatus.Approved;
            migrated.NormalizedName = GlossaryMapper.NormalizedName(glossary.Name);
            migrated.Context = effective.Definition;
            // Structured: the parsed note; plain: the original text; corrupt: unchanged.
            migrated.AdditionalNote = hasJson ? parsed.Meta.Note ?? "" : glossary.AdditionalNote;
            migrated.SchemaVersion = 2;
            migrated.Version = glossary.Version + 1;
            return new PlanOutcome(migrated, parsed.Status == GlossaryMetaStatus.Corrupt);
        }

        private static BlocksGlossary Clone(BlocksGlossary g) => new()
        {
            ItemId = g.ItemId,
            CreateDate = g.CreateDate,
            LastUpdateDate = g.LastUpdateDate,
            CreatedBy = g.CreatedBy,
            LastUpdatedBy = g.LastUpdatedBy,
            TenantId = g.TenantId,
            Name = g.Name,
            Language = g.Language,
            Type = g.Type,
            Context = g.Context,
            AdditionalNote = g.AdditionalNote,
            IsGlobal = g.IsGlobal,
            ModuleIds = g.ModuleIds,
            Version = g.Version,
            NormalizedName = g.NormalizedName,
            Rule = g.Rule,
            CaseSensitive = g.CaseSensitive,
            Variants = g.Variants,
            Translations = g.Translations,
            Status = g.Status,
            SchemaVersion = g.SchemaVersion
        };
    }
}
