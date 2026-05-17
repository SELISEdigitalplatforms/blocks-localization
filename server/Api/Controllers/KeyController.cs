using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Utilities;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.Mvc;

namespace BlocksTemplate.Api.Controllers
{
    /// <summary>
    /// API Controller for managing Key operations.
    /// </summary>
    /// 

    [ApiController]
    [Route("[controller]/[action]")]

    public class KeyController : ControllerBase
    {
        private readonly IKeyManagementService _keyManagementService;
        private readonly IValidator<TranslateBlocksLanguageKeyRequest> _translateBlocksLanguageKeyRequestValidator;


        /// <summary>
        /// Initializes a new instance of the <see cref="KeyController"/> class.
        /// </summary>
        /// <param name="keyManagementService">The service for managing keys.</param>
        /// <param name="changeControllerContext">The context for changing controller state.</param>
        /// <param name="translateBlocksLanguageKeyRequestValidator">The validator for TranslateBlocksLanguageKeyRequest.</param>

        public KeyController(
            IKeyManagementService keyManagementService,
            IValidator<TranslateBlocksLanguageKeyRequest> translateBlocksLanguageKeyRequestValidator)
        {
            _keyManagementService = keyManagementService;
            _translateBlocksLanguageKeyRequestValidator = translateBlocksLanguageKeyRequestValidator;
        }

        /// <summary>
        /// Saves a new or existing key to the system.
        /// </summary>
        /// <param name="key">The key object to be saved.</param>
        /// <returns>An <see cref="ApiResponse"/> indicating the success or failure of the save operation.</returns>

        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::save")]
        public async Task<ApiResponse> Save(Key key)
        {
            if (key == null) BadRequest(new BaseMutationResponse());
            return await _keyManagementService.SaveKeyAsync(key);
        }

        /// <summary>
        /// Saves multiple keys to the system in a single operation.
        /// </summary>
        /// <param name="keys">The list of key objects to be saved.</param>
        /// <returns>An <see cref="ApiResponse"/> indicating the success or failure of the bulk save operation.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::save-keys")]
        public async Task<ApiResponse> SaveKeys([FromBody] List<Key> keys)
        {
            if (keys == null || !keys.Any()) 
                return new ApiResponse("Keys list cannot be null or empty.");
            return await _keyManagementService.SaveKeysAsync(keys);
        }

        /// <summary>
        /// Retrieves all available keys based on applied filters.
        /// </summary>
        /// <param name="query">The query parameters containing filters for key retrieval.</param>
        /// <returns>A <see cref="GetKeysQueryResponse"/> containing the filtered list of keys.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::get-keys")]
        public async Task<GetKeysQueryResponse> Gets([FromBody] GetKeysRequest query)
        {
            if (query == null) BadRequest(new BaseMutationResponse());
            return await _keyManagementService.GetKeysAsync(query);
        }

        /// <summary>
        /// Retrieves keys by an array of key names without pagination or filtering.
        /// </summary>
        /// <param name="request">The request containing an array of key names.</param>
        /// <returns>A <see cref="GetKeysByKeyNamesResponse"/> containing the matched keys and optional error.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::get-keys-by-key-names")]
        public async Task<GetKeysByKeyNamesResponse> GetsByKeyNames([FromBody] GetKeysByKeyNamesRequest request)
        {
            if (request == null)
                return new GetKeysByKeyNamesResponse { ErrorMessage = "Request cannot be null." };
            return await _keyManagementService.GetKeysByKeyNamesAsync(request);
        }

        /// <summary>
        /// Retrieves Key timeline with pagination.
        /// </summary>
        /// <param name="query">The query parameters for filtering and pagination.</param>
        /// <returns>A paginated list of <see cref="KeyTimeline"/> objects.</returns>
        [HttpGet]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::get-timeline")]
        public async Task<GetKeyTimelineQueryResponse> GetTimeline([FromQuery] GetKeyTimelineRequest query)
        {
            if (query == null) BadRequest(new BaseMutationResponse());
            return await _keyManagementService.GetKeyTimelineAsync(query);
        }

        /// <summary>
        /// Retrieves the localization-level overview timeline grouped by operation.
        /// </summary>
        /// <param name="query">The query parameters for filtering and pagination.</param>
        /// <returns>A paginated list of operation-level timeline entries.</returns>
        [HttpGet]
        [Authorize]
        public async Task<GetLocalizationTimelineResponse> GetLocalizationTimeline([FromQuery] GetLocalizationTimelineRequest query)
        {
            if (query == null) BadRequest(new BaseMutationResponse());
            return await _keyManagementService.GetLocalizationTimelineAsync(query);
        }

        /// <summary>
        /// Retrieves timeline entries for a specific operation by OperationId.
        /// </summary>
        /// <param name="query">The query containing the OperationId and pagination parameters.</param>
        /// <returns>A paginated list of <see cref="KeyTimeline"/> entries for the operation.</returns>
        [HttpGet]
        [Authorize]
        public async Task<GetKeyTimelineQueryResponse> GetTimelineByOperationId([FromQuery] GetTimelineByOperationIdRequest query)
        {
            if (query == null) BadRequest(new BaseMutationResponse());
            return await _keyManagementService.GetTimelineByOperationIdAsync(query);
        }

        /// <summary>
        /// Retrieves a specific key by item ID.
        /// </summary>
        /// <param name="request">The request containing the item ID of the key to retrieve.</param>
        /// <returns>A <see cref="Key"/> object if found; otherwise, null.</returns>
        [HttpGet]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::get")]
        public async Task<Key?> Get([FromQuery] GetKeyRequest request)
        {
            if (request == null) BadRequest(new BaseMutationResponse());

            var result = await _keyManagementService.GetAsync(request);
            if (result == null)
            {
                var response = new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "Key", "No key found" }
                    }
                };

                BadRequest(response);
            }

            return result;
        }

        /// <summary>
        /// Deletes a specific key by item ID.
        /// </summary>
        /// <param name="request">The request containing the item ID of the key to delete.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the delete operation.</returns>
        [HttpDelete]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::delete")]
        public async Task<IActionResult> Delete([FromQuery] DeleteKeyRequest request)
        {
            if (request == null) BadRequest(new BaseMutationResponse());

            if (string.IsNullOrWhiteSpace(request.ItemId))
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "ItemId", "Invalid or missing ConfigurationId" }
                    }
                });
            }

            var result = await _keyManagementService.DeleteAsysnc(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Returns a JSON UILM file for a specified module and language.
        /// </summary>
        /// <param name="request">The request containing the project key, module, and language information.</param>
        /// <returns>A JSON UILM file as a string.</returns>
        [HttpGet]
        public async Task GetUilmFile([FromQuery] GetUilmFileRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ProjectKey))
            {
                Response.StatusCode = 401;
                await Response.WriteAsync(string.Empty);
                return;
            }
            if (request == null) BadRequest(new BaseMutationResponse());;
            Response.ContentType = "application/json";

            string result = await _keyManagementService.GetUilmFile(request);
            await Response.WriteAsync(result ?? "");
        }

        /// <summary>
        /// Generates a UILM file for download. Must be called before calling /key/getuilmfile.
        /// </summary>
        /// <param name="request">The request containing the parameters for UILM file generation.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the file generation request.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::generate-uilm-file")]
        public async Task<IActionResult> GenerateUilmFile([FromBody] GenerateUilmFilesRequest request)
        {
            if (request == null) return BadRequest(new BaseMutationResponse());
            await _keyManagementService.SendGenerateUilmFilesEvent(request);
            return Ok(new BaseMutationResponse { IsSuccess = true });
        }

        /// <summary>
        /// Translates all keys without values. If a module is specified, only keys from that module are translated.
        /// </summary>
        /// <param name="request">The request containing the project key and optional module filter.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the translation request.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::translate-all")]
        public async Task<IActionResult> TranslateAll(TranslateAllRequest request)
        {
            if (request == null) BadRequest(new BaseMutationResponse());

            if (string.IsNullOrWhiteSpace(request.ProjectKey))
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "ProjectKey", "Invalid or missing ProjectKey" }
                    }
                });
            }

            await _keyManagementService.SendTranslateAllEvent(request);
            return Ok(new BaseMutationResponse { IsSuccess = true });
        }

        /// <summary>
        /// Translates a specific BlocksLanguageKey by sending it to the translation queue.
        /// </summary>
        /// <param name="request">The request containing key ID, project key, and translation parameters.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the translation request.</returns>
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> TranslateKey(TranslateBlocksLanguageKeyRequest request)
        {
            if (request == null) return BadRequest(new BaseMutationResponse());;

            var validationResult = await _translateBlocksLanguageKeyRequestValidator.ValidateAsync(request);
            if (!validationResult.IsValid)
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = validationResult.Errors.ToDictionary(e => e.PropertyName, e => e.ErrorMessage)
                });
            }

            await _keyManagementService.SendTranslateBlocksLanguageKeyEvent(request);
            return Ok(new BaseMutationResponse { IsSuccess = true });
        }

        /// <summary>
        /// Imports a UILM file. Existing keys are updated. Existing modules are not replaced. New keys are added; removed keys are ignored.
        /// </summary>
        /// <param name="request">The request containing the UILM file data and project key.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the import operation.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::uilm-import")]
        public async Task<IActionResult> UilmImport([FromBody] UilmImportRequest request)
        {
            if (request == null) return BadRequest(new BaseMutationResponse());
            if (string.IsNullOrWhiteSpace(request.ProjectKey))
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "ProjectKey", "Invalid or missing ProjectKey" }
                    }
                });
            }
            await _keyManagementService.SendUilmImportEvent(request);
            return Ok(new BaseMutationResponse { IsSuccess = true });
        }

        /// <summary>
        /// Exports all modules or selected ones with their keys.
        /// </summary>
        /// <param name="request">The request containing the project key and optional module selection for export.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the export operation.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::uilm-export")]
        public async Task<IActionResult> UilmExport([FromBody] UilmExportRequest request)
        {

            if (request == null) return BadRequest(new BaseMutationResponse());
            if (string.IsNullOrWhiteSpace(request.ProjectKey))
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "ProjectKey", "Invalid or missing ProjectKey" }
                    }
                });
            }

            await _keyManagementService.SendUilmExportEvent(request);
            return Ok(new BaseMutationResponse { IsSuccess = true });
        }

        /// <summary>
        /// Deletes entire key collections. (Admin use only; to be removed from public API.)
        /// </summary>
        /// <param name="request">The request containing the list of collections to delete.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the delete operation.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::delete-collections")]
        [ApiExplorerSettings(IgnoreApi = true)]
        public async Task<IActionResult> DeleteCollections([FromBody] DeleteCollectionsRequest request)
        {
            if (request == null) return BadRequest(new BaseMutationResponse());

            if (request.Collections == null || !request.Collections.Any())
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "Collections", "At least one collection must be specified" }
                    }
                });
            }

            var result = await _keyManagementService.DeleteCollectionsAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Gets a paginated list of exported UILM files.
        /// </summary>
        /// <param name="request">The request containing pagination parameters.</param>
        /// <returns>A paginated list of exported UILM files.</returns>
        [HttpGet]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::get-uilm-exported-files")]
        public async Task<IActionResult> GetUilmExportedFiles([FromQuery] GetUilmExportedFilesRequest request)
        {
            if (request == null) return BadRequest(new BaseMutationResponse());

            if (request.PageSize <= 0 || request.PageNumber < 0)
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "Pagination", "PageSize must be greater than 0 and PageNumber must be 0 or greater" }
                    }
                });
            }

            var result = await _keyManagementService.GetUilmExportedFilesAsync(request);
            return Ok(result);
        }

        /// <summary>
        /// Gets a paginated list of language file generation history entries.
        /// </summary>
        /// <param name="request">The request containing pagination parameters.</param>
        /// <returns>A paginated list of language file generation history entries.</returns>
        [HttpGet]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::get-language-file-generation-history")]
        public async Task<IActionResult> GetLanguageFileGenerationHistory([FromQuery] GetLanguageFileGenerationHistoryRequest request)
        {
            if (request == null) return BadRequest(new BaseMutationResponse());

            if (request.PageSize <= 0 || request.PageNumber < 0)
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "Pagination", "PageSize must be greater than 0 and PageNumber must be 0 or greater" }
                    }
                });
            }

            var result = await _keyManagementService.GetLanguageFileGenerationHistoryAsync(request);
            return Ok(result);
        }

        /// <summary>
        /// Reverts keys to a previous state.
        /// </summary>
        /// <param name="request">The request containing the item ID and rollback parameters.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the rollback operation.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::rollback")]
        public async Task<IActionResult> RollBack([FromBody] RollbackRequest request)
        {
            if (request == null) return BadRequest(new BaseMutationResponse());

            if (string.IsNullOrWhiteSpace(request.ItemId))
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "ItemId", "Invalid or missing ItemId" }
                    }
                });
            }

            var result = await _keyManagementService.RollbackAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }
    }
}
