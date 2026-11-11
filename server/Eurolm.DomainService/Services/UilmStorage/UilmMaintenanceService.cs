using Blocks.Genesis;
using DomainService.Storage;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Repositories.UilmStorage;
using Microsoft.Extensions.Logging;
using StorageDriver;
using System.Text.Json;

namespace Eurolm.DomainService.Services.UilmStorage
{
    public class UilmMaintenanceService : IUilmMaintenanceService
    {
        public const string TaskName = "uilm-maintenance";
        private const string FileNotFound = "file_not_found";
        private const int ReconcilePageSize = 500;

        private readonly IUilmStoredFileRepository _storedFiles;
        private readonly IUilmStorageSettingsRepository _settings;
        private readonly IKeyRepository _keyRepository;
        private readonly IStorageDriverService _storageDriver;
        private readonly ITenants _tenants;
        private readonly UilmStorageInfrastructure _infrastructure;
        private readonly UilmStorageOptions _options;
        private readonly ILogger<UilmMaintenanceService> _logger;

        public UilmMaintenanceService(
            IUilmStoredFileRepository storedFiles,
            IUilmStorageSettingsRepository settings,
            IKeyRepository keyRepository,
            IStorageDriverService storageDriver,
            ITenants tenants,
            UilmStorageInfrastructure infrastructure,
            ILogger<UilmMaintenanceService> logger)
        {
            _storedFiles = storedFiles;
            _settings = settings;
            _keyRepository = keyRepository;
            _storageDriver = storageDriver;
            _tenants = tenants;
            _infrastructure = infrastructure;
            _options = infrastructure.Options;
            _logger = logger;
        }

        public async Task RunAsync(string? payload)
        {
            if (!TryParsePayload(payload, out var payloadTenantId))
            {
                // A retry can't fix a bad payload, so it is dropped rather than thrown.
                _logger.LogWarning("UILM maintenance ignored a schedule payload that is not a {TaskName} task", TaskName);
                return;
            }

            List<string> tenantIds;
            try
            {
                tenantIds = payloadTenantId != null
                    ? [payloadTenantId]
                    : _tenants.GetTenantDatabaseConnectionStrings().Keys.ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UILM maintenance could not list the tenants");
                return;
            }

            foreach (var tenantId in tenantIds)
            {
                try
                {
                    // No user: the scheduler's context. ExecuteInContext restores the caller's context afterwards.
                    await BlocksContext.ExecuteInContext(NoUserContext(tenantId), () => RunTenantAsync());
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "UILM maintenance failed for tenant {TenantId}", tenantId);
                }
            }
        }

        /// <summary>True for a JSON object whose <c>task</c> is <see cref="TaskName"/>; returns its optional <c>tenantId</c>.</summary>
        public static bool TryParsePayload(string? payload, out string? tenantId)
        {
            tenantId = null;
            if (string.IsNullOrWhiteSpace(payload))
            {
                return false;
            }
            try
            {
                using var document = JsonDocument.Parse(payload);
                var root = document.RootElement;
                if (root.ValueKind != JsonValueKind.Object
                    || !root.TryGetProperty("task", out var task)
                    || task.ValueKind != JsonValueKind.String
                    || !string.Equals(task.GetString()?.Trim(), TaskName, StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
                if (root.TryGetProperty("tenantId", out var tenant) && tenant.ValueKind == JsonValueKind.String
                    && !string.IsNullOrWhiteSpace(tenant.GetString()))
                {
                    tenantId = tenant.GetString()!.Trim();
                }
                return true;
            }
            catch (JsonException)
            {
                return false;
            }
        }

        private async Task<int> RunTenantAsync()
        {
            var now = UtcNow();
            var deleted = 0;
            for (var claimed = 0; claimed < _options.MaintenanceBatchSize; claimed++)
            {
                var file = await _storedFiles.ClaimDueAsync(now, now + _options.MaintenanceLease);
                if (file == null)
                {
                    break;
                }
                if (await DeleteDueFileAsync(file, now))
                {
                    deleted++;
                }
            }

            if (await _settings.TryStartReconcileAsync(now, _options.ReconcileInterval))
            {
                await ReconcileAsync(now);
            }
            return deleted;
        }

        private async Task<bool> DeleteDueFileAsync(UilmStoredFile file, DateTime now)
        {
            // A pointer switched back to this file (or a race with a publish): it is in use, so it stays.
            if ((await _keyRepository.GetReferencedUilmFileIdsAsync([file.Id])).Count > 0)
            {
                await _storedFiles.MarkLiveAsync([file.Id]);
                return false;
            }

            if (await DeleteFromStorageAsync(file.Id))
            {
                await _storedFiles.RemoveAsync(file.Id);
                return true;
            }

            var attempts = await _storedFiles.RecordFailedDeleteAsync(file.Id, now);
            if (attempts >= _options.StuckDeleteAttempts)
            {
                _logger.LogError("UilmFileDeleteStuck: file {FileId} of module {ModuleName} language {Language} failed to delete {Attempts} times",
                    file.Id, file.ModuleName, file.Language, attempts);
            }
            return false;
        }

        private async Task<bool> DeleteFromStorageAsync(string fileId)
        {
            try
            {
                var response = await _storageDriver.DeleteFileAsync(new DeleteFileRequest { FileId = fileId, Permanent = true });
                if (response?.IsSuccess == true || response?.Errors?.ContainsKey(FileNotFound) == true)
                {
                    return true;
                }
                _logger.LogWarning("UILM maintenance could not delete file {FileId}: {Errors}",
                    fileId, response?.Errors == null ? "no response" : string.Join(", ", response.Errors.Keys));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "UILM maintenance could not delete file {FileId}", fileId);
            }
            return false;
        }

        /// <summary>
        /// Retires ledger rows that no pointer uses: uploads that never switched a pointer (older than
        /// <see cref="UilmStorageOptions.OrphanUploadAge"/>, deleted on the next run) and live files whose pointer is
        /// gone (deleted after <see cref="UilmStorageOptions.RetireDelay"/>).
        /// </summary>
        private async Task ReconcileAsync(DateTime now)
        {
            var orphans = await RetireUnreferencedAsync(UilmStoredFileState.Uploading, now - _options.OrphanUploadAge, now);
            var unused = await RetireUnreferencedAsync(UilmStoredFileState.Live, DateTime.MaxValue, now + _options.RetireDelay);
            if (orphans + unused > 0)
            {
                _logger.LogInformation("UILM reconcile retired {OrphanCount} abandoned uploads and {UnusedCount} unused files", orphans, unused);
            }
        }

        private async Task<long> RetireUnreferencedAsync(string state, DateTime createdBefore, DateTime deleteAfter)
        {
            long retired = 0;
            string? afterId = null;
            while (true)
            {
                var ids = await _storedFiles.GetIdsAsync(state, createdBefore, afterId, ReconcilePageSize);
                if (ids.Count == 0)
                {
                    break;
                }
                var referenced = await _keyRepository.GetReferencedUilmFileIdsAsync(ids);
                var unreferenced = ids.Where(id => !referenced.Contains(id)).ToList();
                retired += await _storedFiles.RetireFromStateAsync(unreferenced, state, deleteAfter);
                if (ids.Count < ReconcilePageSize)
                {
                    break;
                }
                afterId = ids[^1];
            }
            return retired;
        }

        private BlocksContext NoUserContext(string tenantId) => BlocksContext.Create(
            tenantId: tenantId,
            roles: Array.Empty<string>(),
            userId: "",
            isAuthenticated: false,
            requestUri: "",
            organizationId: "",
            expireOn: UtcNow().Add(_options.MaintenanceLease),
            email: "",
            permissions: Array.Empty<string>(),
            userName: "",
            phoneNumber: "",
            displayName: "",
            oauthToken: "",
            originalTenantId: tenantId,
            applicationDomain: "",
            impersonated: false,
            impersonationSessionId: "");

        private DateTime UtcNow() => _infrastructure.UtcNow();
    }
}
