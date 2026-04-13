using Blocks.Genesis;
using BlocksTemplate.DomainService.Shared.DTOs;
using Microsoft.Extensions.Configuration;
using System.Text.Json;

namespace BlocksTemplate.DomainService.Services.HelperService
{
    public class NotificationService : INotificationService
    {
        private readonly ICryptoService _cryptoService;
        private readonly ITenants _tenants;
        private readonly IConfiguration _configuration;
        private readonly IHttpHelperServices _httpHelperServices;
        public NotificationService(
                                   ICryptoService cryptoService,
                                   ITenants tenants,
                                   IConfiguration configuration,
                                   IHttpHelperServices httpHelperServices)
        {
            _cryptoService = cryptoService;
            _tenants = tenants;
            _configuration = configuration;
            _httpHelperServices = httpHelperServices;
        }

        public async Task<bool> NotifyExportEvent(bool response, string fileId, string? messageCoRelationId, string tenantId)
        {
            var requestData = new
            {
                ConnectionId = messageCoRelationId,
                Roles = new List<string> { },
                UserIds = new List<string> { BlocksContext.GetContext()?.UserId ?? "" },
                DenormalizedPayload = JsonSerializer.Serialize(new
                {
                    Message = new
                    {
                        IsSuccess = response,
                        title = "Uilm Export Completed",
                        description = "Completed export",
						FileId = fileId
					}
                }),
                SaveDenormalizedPayloadAsAnObject = false,
                ConfiguratoinName = _configuration["BlocksAppNotificationReceiver"],
                ContentAvailable = true,
                ResponseKey = messageCoRelationId,
                ResponseValue = response.ToString(),
			};

            var blocksKey = _configuration["RootTenantId"];
            var rootTenantId = _configuration["RootTenantId"];
            var salt = _tenants.GetTenantByID(rootTenantId)?.TenantSalt;
            var actulalSecret = _cryptoService.Hash(rootTenantId, salt);

            var url = _configuration["NotificationServiceUrl"];
            var headers = new Dictionary<string, string>
            {
                { "x-blocks-key", blocksKey },
                { "Secret", actulalSecret}
            };

            var (result1, result2) = await _httpHelperServices.MakeHttpPostRequest<NotificationResponse>(
                 requestData, url, headers);

            return result1 == null ? false : result1.isSuccess;
        }

        public async Task<bool> NotifyTranslateAllEvent(bool response, string? messageCoRelationId)
        {
            var requestData = new
            {
                ConnectionId = messageCoRelationId,
                Roles = new List<string> { },
                UserIds = new List<string> { BlocksContext.GetContext()?.UserId ?? "" },
                DenormalizedPayload = JsonSerializer.Serialize(new
                {
                    IsSuccess = response,
                    title = "Translation Completed",
                    description = "Completed translation for all keys"
                }),
                SaveDenormalizedPayloadAsAnObject = false,
                ConfiguratoinName = "translate-all",
                ContentAvailable = true,
                ResponseKey = "Translate All",
                ResponseValue = "Successfully translated all keys"
            };

            var blocksKey = _configuration["RootTenantId"];
            var rootTenantId = _configuration["RootTenantId"];
            var salt = _tenants.GetTenantByID(rootTenantId)?.TenantSalt;
            var actulalSecret = _cryptoService.Hash(rootTenantId, salt);

            var url = _configuration["NotificationServiceUrl"];
            var headers = new Dictionary<string, string>
            {
                { "x-blocks-key", blocksKey },
                { "Secret", actulalSecret}
            };

            var (result1, result2) = await _httpHelperServices.MakeHttpPostRequest<NotificationResponse>(
                 requestData, url, headers);

            return result1 == null ? false : result1.isSuccess;
        }

        public async Task<bool> NotifyTranslateBlocksLanguageKeyEvent(bool response, string? messageCoRelationId)
        {
            var requestData = new
            {
                ConnectionId = messageCoRelationId,
                Roles = new List<string> { },
                UserIds = new List<string> { BlocksContext.GetContext()?.UserId ?? "" },
                DenormalizedPayload = JsonSerializer.Serialize(new
                {
                    IsSuccess = response,
                    title = "Key Translation Completed",
                    description = "Completed translation for specific language key"
                }),
                SaveDenormalizedPayloadAsAnObject = false,
                ConfiguratoinName = "translate-all",
                ContentAvailable = true,
                ResponseKey = "Translate Key",
                ResponseValue = "Successfully translated language key"
            };

            var blocksKey = _configuration["RootTenantId"];
            var rootTenantId = _configuration["RootTenantId"];
            var salt = _tenants.GetTenantByID(rootTenantId)?.TenantSalt;
            var actulalSecret = _cryptoService.Hash(rootTenantId, salt);

            var url = _configuration["NotificationServiceUrl"];
            var headers = new Dictionary<string, string>
            {
                { "x-blocks-key", blocksKey },
                { "Secret", actulalSecret}
            };

            var (result1, result2) = await _httpHelperServices.MakeHttpPostRequest<NotificationResponse>(
                 requestData, url, headers);

            return result1 == null ? false : result1.isSuccess;
        }

        public async Task<bool> NotifyEnvironmentDataMigrationEvent(bool response, string? messageCoRelationId, string projectKey, string targetedProjectKey)
        {
            var requestData = new
            {
                ConnectionId = messageCoRelationId,
                Roles = new List<string> { },
                UserIds = new List<string> { BlocksContext.GetContext()?.UserId ?? "" },
                DenormalizedPayload = JsonSerializer.Serialize(new
                {
                    IsSuccess = response,
                    title = "Language Migration Completed",
                    description = $"Language Migration {(response ? "completed successfully" : "failed")}",
                    projectKey = projectKey,
                    targetedProjectKey = targetedProjectKey
                }),
                SaveDenormalizedPayloadAsAnObject = false,
                ConfiguratoinName = "EnvironmentDataMigration",
                ContentAvailable = true,
                ResponseKey = "Language Migration",
                ResponseValue = response ? "Migration completed" : "Migration failed"
            };

            var blocksKey = _configuration["RootTenantId"];
            var rootTenantId = _configuration["RootTenantId"];
            var salt = _tenants.GetTenantByID(rootTenantId)?.TenantSalt;
            var actulalSecret = _cryptoService.Hash(rootTenantId, salt);

            var url = _configuration["NotificationServiceUrl"];
            var headers = new Dictionary<string, string>
            {
                { "x-blocks-key", blocksKey },
                { "Secret", actulalSecret}
            };

            var (result1, result2) = await _httpHelperServices.MakeHttpPostRequest<NotificationResponse>(
                 requestData, url, headers);

            return result1 == null ? false : result1.isSuccess;
        }

        public async Task<bool> NotifyExtensionEvent(bool response, string projectKey) {
            var requestData = new
            {
                ConnectionId = "",
                Roles = new List<string> { },
                UserIds = new List<string> { BlocksContext.GetContext()?.UserId ?? "" },
                DenormalizedPayload = JsonSerializer.Serialize(new
                {
                    IsSuccess = response,
                    title = "Extension Sync Completed",
                    description = $"Extension Sync {(response ? "completed successfully" : "failed")}",
                    projectKey = projectKey
                }),
                SaveDenormalizedPayloadAsAnObject = false,
                ConfiguratoinName = "ExtensionGoLiveEvent",
                ContentAvailable = true,
                ResponseKey = "Extension Sync",
                ResponseValue = response ? "Extension sync completed" : "Extension sync failed"
            };

            var blocksKey = projectKey;
            var rootTenantId = projectKey;
            var salt = _tenants.GetTenantByID(rootTenantId)?.TenantSalt;
            var actulalSecret = _cryptoService.Hash(rootTenantId, salt);

            var url = _configuration["NotificationServiceUrl"];
            var headers = new Dictionary<string, string>
            {
                { "x-blocks-key", blocksKey },
                { "Secret", actulalSecret}
            };

            var (result1, result2) = await _httpHelperServices.MakeHttpPostRequest<NotificationResponse>(
                 requestData, url, headers);

            return result1 == null ? false : result1.isSuccess;
        }
    }
}
