using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Microsoft.Extensions.Logging;

namespace Eurolm.DomainService.Services
{
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
            var leftLegacy = PlanAll(all, report, writes);

            // Group by the name each document will have after the migration.
            report.DuplicateGroups = all
                .GroupBy(g => GlossaryMapper.NormalizedName(g.Name), StringComparer.Ordinal)
                .Where(group => group.Count() > 1)
                .Select(group => group.Select(g => g.ItemId).OrderBy(id => id, StringComparer.Ordinal).ToList())
                .ToList();

            // Read the ids again right before the cleanup: a glossary created (and tagged) since the snapshot above
            // is not stale. The repository then pulls only the stale ids it found, never "everything else".
            var existingIds = all.Select(g => g.ItemId).ToHashSet(StringComparer.Ordinal);
            if (!dryRun) existingIds.UnionWith((await _glossaryRepository.GetAllEntitiesAsync(tenantId)).Select(g => g.ItemId));
            report.StaleKeyRefsRemoved = await _keyRepository.RemoveStaleGlossaryIdsAsync(existingIds, dryRun, BatchSize);

            var migrated = writes.Count;
            if (!dryRun)
            {
                var (modified, skipped) = await WriteAllAsync(writes, report);
                leftLegacy += skipped;
                migrated = modified;
            }
            report.Migrated = migrated;

            var canCreateIndex = report.DuplicateGroups.Count == 0 && leftLegacy == 0;
            if (report.DuplicateGroups.Count > 0)
                report.Notes.Add("Duplicate normalized names block the unique index; rename or delete them and run again.");
            if (leftLegacy > 0)
                report.Notes.Add("Glossaries that are not yet migrated (for example an unsupported terminology version) block the unique index; fix or delete them and run again.");

            if (canCreateIndex && !dryRun)
            {
                try
                {
                    await _glossaryRepository.CreateNormalizedNameUniqueIndexAsync();
                }
                catch (Exception ex)
                {
                    // For example a duplicate created by a concurrent save after the snapshot; the writes above stay.
                    _logger.LogWarning(ex, "Glossary migration could not create the unique name index");
                    report.Notes.Add("The unique name index could not be created (a duplicate name may have been saved during the run); run the migration again.");
                    canCreateIndex = false;
                }
            }
            report.UniqueIndexCreated = canCreateIndex;

            if (!dryRun)
            {
                if (migrated > 0) _matcherCache?.Invalidate(tenantId);
                // Every real run re-checks the whole project (flag on only), even with nothing migrated: a tenant
                // migrated while the flag was off has no stored violations yet.
                if (_recheckService != null) await _recheckService.TriggerAsync(Array.Empty<string>());
            }

            _logger.LogInformation(
                "Glossary migration {Mode}: total {Total}, migrated {Migrated}, already {AlreadyMigrated}, corrupt {Corrupt}, duplicate groups {DuplicateGroups}, stale key refs {StaleKeyRefs}, unique index {UniqueIndex}",
                dryRun ? "dry run" : "run", report.Total, report.Migrated, report.AlreadyMigrated, report.Corrupt.Count,
                report.DuplicateGroups.Count, report.StaleKeyRefsRemoved, report.UniqueIndexCreated);

            return report;
        }

        /// <summary>Plans every document, collecting the writes; returns how many legacy documents stay unmigrated.</summary>
        private static int PlanAll(List<BlocksGlossary> all, MigrateGlossariesResponse report, List<(BlocksGlossary Glossary, int ExpectedVersion)> writes)
        {
            var leftLegacy = 0;

            foreach (var glossary in all)
            {
                var outcome = Plan(glossary);
                if (outcome.Corrupt) report.Corrupt.Add(glossary.ItemId);
                if (outcome.Updated != null) writes.Add((outcome.Updated, glossary.Version));
                else if (glossary.SchemaVersion < 2) leftLegacy++;
                else report.AlreadyMigrated++;
            }

            return leftLegacy;
        }

        private async Task<(int Modified, int Skipped)> WriteAllAsync(List<(BlocksGlossary Glossary, int ExpectedVersion)> writes, MigrateGlossariesResponse report)
        {
            long modified = 0;
            var skipped = 0;
            foreach (var batch in writes.Chunk(BatchSize))
            {
                modified += await _glossaryRepository.ReplaceManyAsync(batch);
            }
            if (modified < writes.Count)
            {
                // A document changed between the read and the write; it is picked up by the next run.
                skipped = (int)(writes.Count - modified);
                report.Notes.Add($"{writes.Count - modified} glossaries changed during the migration and were skipped; run it again.");
            }
            return ((int)modified, skipped);
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
                // A missing or outdated NormalizedName would break the unique index (every null is the same key).
                var nameOutdated = !string.Equals(glossary.NormalizedName, GlossaryMapper.NormalizedName(glossary.Name), StringComparison.Ordinal);
                if (!hasJson && !hasMarker && !nameOutdated) return new PlanOutcome(null, corrupt);

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
            SchemaVersion = g.SchemaVersion,
            PartOfSpeech = g.PartOfSpeech,
            UsageExamples = g.UsageExamples
        };
    }
}
