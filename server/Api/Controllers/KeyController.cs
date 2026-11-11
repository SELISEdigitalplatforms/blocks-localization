using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.UilmStorage;
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
        private readonly IValidator<TranslateBlocksLanguageKeysRequest> _translateBlocksLanguageKeysRequestValidator;
        private readonly IValidator<GetKeysRequest> _getKeysRequestValidator;
        private readonly IValidator<DeleteKeysRequest> _deleteKeysRequestValidator;


        /// <summary>
        /// Initializes a new instance of the <see cref="KeyController"/> class.
        /// </summary>
        /// <param name="keyManagementService">The service for managing keys.</param>
        /// <param name="changeControllerContext">The context for changing controller state.</param>
        /// <param name="translateBlocksLanguageKeyRequestValidator">The validator for TranslateBlocksLanguageKeyRequest.</param>
        /// <param name="translateBlocksLanguageKeysRequestValidator">The validator for TranslateBlocksLanguageKeysRequest.</param>
        /// <param name="getKeysRequestValidator">The validator for GetKeysRequest.</param>
        /// <param name="deleteKeysRequestValidator">The validator for DeleteKeysRequest.</param>

        public KeyController(
            IKeyManagementService keyManagementService,
            IValidator<TranslateBlocksLanguageKeyRequest> translateBlocksLanguageKeyRequestValidator,
            IValidator<TranslateBlocksLanguageKeysRequest> translateBlocksLanguageKeysRequestValidator,
            IValidator<GetKeysRequest> getKeysRequestValidator,
            IValidator<DeleteKeysRequest> deleteKeysRequestValidator)
        {
            _keyManagementService = keyManagementService;
            _translateBlocksLanguageKeyRequestValidator = translateBlocksLanguageKeyRequestValidator;
            _translateBlocksLanguageKeysRequestValidator = translateBlocksLanguageKeysRequestValidator;
            _getKeysRequestValidator = getKeysRequestValidator;
            _deleteKeysRequestValidator = deleteKeysRequestValidator;
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
            if (key == null) return new ApiResponse("Key cannot be null.");
            return await _keyManagementService.SaveKeyAsync(key);
        }

        /// <summary>
        /// Saves multiple keys to the system in a single operation.
        /// </summary>
        /// <param name="keys">The list of key objects to be saved.</param>
        /// <returns>An <see cref="ApiResponse"/> indicating the success or failure of the bulk save operation.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::savekeys")]
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
        /// <returns>A <see cref="GetKeysQueryResponse"/> containing the filtered list of keys; 400 for invalid paging,
        /// sort, cursor or search input; 503 when the query exceeds its time limit. The error body's
        /// <c>Errors</c> values are the error codes in <see cref="KeyListErrorCodes"/>.</returns>
        // Read-only, but intentionally POST: the query carries a complex filter body
        // (module, translation status, missing languages, date range, paging) that does not
        // fit safely in a query string. Not cacheable by design.
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::gets")]
        public async Task<ActionResult<GetKeysQueryResponse>> Gets([FromBody] GetKeysRequest query)
        {
            if (query == null) return new GetKeysQueryResponse { Keys = new List<Key>(), TotalCount = 0 };

            var validationResult = await _getKeysRequestValidator.ValidateAsync(query);
            if (!validationResult.IsValid)
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(g => g.Key, g => g.First().ErrorCode)
                });
            }

            try
            {
                return await _keyManagementService.GetKeysAsync(query);
            }
            catch (KeyListException ex)
            {
                return StatusCode(ex.StatusCode, new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string> { [ex.Field] = ex.ErrorCode }
                });
            }
        }

        /// <summary>
        /// Counts duplicate keys (same module and key name) and duplicate module names for the
        /// current tenant, and reports whether the unique indexes are in place. Read-only.
        /// </summary>
        /// <returns>A <see cref="GetDuplicateSummaryResponse"/> with the counts and index state.</returns>
        [HttpGet]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::gets")]
        public async Task<GetDuplicateSummaryResponse> GetDuplicateSummary()
        {
            return await _keyManagementService.GetDuplicateSummaryAsync();
        }

        /// <summary>
        /// Creates the unique key and module-name indexes for the current tenant, each only when
        /// that collection has no duplicates. Safe to call repeatedly.
        /// </summary>
        /// <returns>An <see cref="EnforceUniquenessResponse"/> saying which indexes are in place.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::deletekeys")]
        public async Task<EnforceUniquenessResponse> EnforceUniqueness()
        {
            return await _keyManagementService.EnforceUniquenessAsync();
        }

        /// <summary>
        /// Retrieves keys by an array of key names without pagination or filtering.
        /// </summary>
        /// <param name="request">The request containing an array of key names.</param>
        /// <returns>A <see cref="GetKeysByKeyNamesResponse"/> containing the matched keys and optional error.</returns>
        // Read-only, but intentionally POST: the request carries a variable-length list of
        // key names in the body, which does not fit safely in a query string. Not cacheable by design.
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::getkeysbykeynames")]
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
        [ProtectedEndPoint($"{Constants.ServiceName}::key::gettimeline")]
        public async Task<GetKeyTimelineQueryResponse> GetTimeline([FromQuery] GetKeyTimelineRequest query)
        {
            if (query == null) return new GetKeyTimelineQueryResponse();
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
            if (query == null) return new GetLocalizationTimelineResponse();
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
            if (query == null) return new GetKeyTimelineQueryResponse();
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
            if (request == null) return null;

            var result = await _keyManagementService.GetAsync(request);
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
            if (request == null) return BadRequest(new BaseMutationResponse());

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

            var result = await _keyManagementService.DeleteAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Deletes multiple keys, named by item IDs or by a Key/Gets filter (at most 10,000). All deleted keys share
        /// the same OperationId in the timeline.
        /// </summary>
        /// <param name="request">The item IDs, or the filter with the excluded IDs and the expected count.</param>
        /// <returns>A <see cref="BulkKeyActionResponse"/>: 400 TOO_MANY_KEYS, 409 KEY_SET_CHANGED or 503 QUERY_TIMEOUT
        /// under Errors["Target"] when the target can't be acted on.</returns>
        // Bulk delete requires a request body (the list of item ids). Many proxies and HTTP
        // clients drop the body of a DELETE request, so POST is accepted as the reliable verb.
        // The DELETE verb is kept for backward compatibility with existing callers.
        [HttpPost]
        [HttpDelete]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::deletekeys")]
        public async Task<IActionResult> DeleteKeys([FromBody] DeleteKeysRequest request)
        {
            if (request == null) return BadRequest(new BaseMutationResponse());

            var validationResult = await _deleteKeysRequestValidator.ValidateAsync(request);
            if (!validationResult.IsValid) return BadRequest(ToValidationResponse(validationResult));

            try
            {
                var result = await _keyManagementService.DeleteKeysAsync(request);
                return result.IsSuccess ? Ok(result) : BadRequest(result);
            }
            catch (BulkKeyTargetException ex)
            {
                return StatusCode(ex.StatusCode, ex.ToResponse());
            }
            catch (KeyListException ex)
            {
                return StatusCode(ex.StatusCode, ToBulkTargetError(ex));
            }
        }

        private static BaseMutationResponse ToValidationResponse(FluentValidation.Results.ValidationResult validationResult) => new()
        {
            IsSuccess = false,
            // A property can fail more than one rule; the first message is reported.
            Errors = validationResult.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.First().ErrorMessage)
        };

        private static BulkKeyActionResponse ToBulkTargetError(KeyListException ex) => new()
        {
            IsSuccess = false,
            Errors = new Dictionary<string, string> { [BulkKeyTarget.Field] = ex.ErrorCode }
        };

        /// <summary>
        /// Returns a JSON UILM file for a specified module and language.
        /// </summary>
        /// <param name="request">The request containing the project key, module, and language information.</param>
        /// <param name="uilmFileReader">Resolves the published file (spec 6.7).</param>
        /// <returns>A JSON UILM file as a string.</returns>
        [HttpGet]
        [Authorize]
        public async Task GetCloudUilmFile([FromQuery] GetUilmFileRequest request, [FromServices] IUilmFileReader uilmFileReader)
        {
            await WriteUilmFileAsync(request, uilmFileReader);
        }

        /// <summary>
        /// Returns a JSON UILM file for a specified module and language, for anonymous callers with the project key.
        /// A file published to Storage carries an <c>ETag</c>; a matching <c>If-None-Match</c> gets <c>304</c>.
        /// </summary>
        /// <param name="request">The module and language.</param>
        /// <param name="uilmFileReader">Resolves the published file (spec 6.7).</param>
        [HttpGet]
        public async Task GetUilmFile([FromQuery] GetUilmFileRequest request, [FromServices] IUilmFileReader uilmFileReader)
        {
            await WriteUilmFileAsync(request, uilmFileReader);
        }

        /// <summary>Writes the response for both read endpoints (spec 6.7).</summary>
        private async Task WriteUilmFileAsync(GetUilmFileRequest request, IUilmFileReader uilmFileReader)
        {
            if (request == null)
            {
                Response.StatusCode = 400;
                return;
            }

            var result = await uilmFileReader.ReadAsync(request, Request.Headers.IfNoneMatch.ToString());
            switch (result.Kind)
            {
                case UilmFileReadKind.NotModified:
                    Response.StatusCode = StatusCodes.Status304NotModified;
                    SetFileCacheHeaders(result.ETag!);
                    return;
                case UilmFileReadKind.Unavailable:
                    Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                    Response.Headers.RetryAfter = "30";
                    return;
                case UilmFileReadKind.File:
                    Response.ContentType = "application/json";
                    SetFileCacheHeaders(result.ETag!);
                    Response.ContentLength = result.Bytes!.Length;
                    await Response.Body.WriteAsync(result.Bytes);
                    return;
                default:
                    Response.ContentType = "application/json";
                    await Response.WriteAsync(result.Content ?? "");
                    return;
            }
        }

        private void SetFileCacheHeaders(string etag)
        {
            Response.Headers.ETag = etag;
            Response.Headers.CacheControl = "no-cache";
        }

        /// <summary>
        /// Generates a UILM file for download. Must be called before calling /key/getuilmfile.
        /// </summary>
        /// <param name="request">The request containing the parameters for UILM file generation.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the file generation request.</returns>
        [HttpPost]
         [ProtectedEndPoint($"{Constants.ServiceName}::key::generateuilmfile")]
        public async Task<IActionResult> GenerateUilmFile([FromBody] GenerateUilmRequest request)
        {
            if (request == null) return BadRequest(new BaseMutationResponse());
            await _keyManagementService.SendGenerateUilmFilesEvent(new GenerateUilmFilesRequest() { Guid=request.Guid,ModuleId=request.ModuleId,ForceUpload=request.ForceUpload});
            return Ok(new BaseMutationResponse { IsSuccess = true });
        }

        /// <summary>
        /// Queues a UILM Storage task for the caller's tenant only: <c>uilm-maintenance</c> (backfill, content removal,
        /// retired file deletion and reconcile) or <c>uilm-restore-content</c>.
        /// </summary>
        /// <param name="request">Optional <c>{"task": ...}</c>; without a body or task, <c>uilm-maintenance</c> runs.</param>
        /// <param name="uilmMaintenanceQueue">Queues the run.</param>
        /// <returns><c>isSuccess: true</c> once the run is queued.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::runuilmmaintenance")]
        public async Task<IActionResult> RunUilmMaintenance(
            [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] RunUilmMaintenanceRequest? request,
            [FromServices] IUilmMaintenanceQueue uilmMaintenanceQueue)
        {
            await uilmMaintenanceQueue.QueueForCurrentTenantAsync(request?.Task);
            return Ok(new BaseMutationResponse { IsSuccess = true });
        }

        /// <summary>
        /// Translates all keys without values. If a module is specified, only keys from that module are translated.
        /// </summary>
        /// <param name="request">The request containing the project key and optional module filter.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the translation request.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::translateall")]
        public async Task<IActionResult> TranslateAll(TranslateAllRequest request)
        {
            if (request == null) return BadRequest(new BaseMutationResponse());

            await _keyManagementService.SendTranslateAllEvent(request);
            return Ok(new BaseMutationResponse { IsSuccess = true });
        }

        /// <summary>
        /// Translates a specific BlocksLanguageKey by sending it to the translation queue.
        /// </summary>
        /// <param name="request">The request containing key ID, project key, and translation parameters.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the translation request.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::translatekey")]
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
        /// Translates multiple BlocksLanguageKeys, named by key IDs or by a Key/Gets filter (at most 10,000), by sending
        /// events of at most 1,000 keys to the translation queue. All translated keys share the same OperationId in the timeline.
        /// </summary>
        /// <param name="request">The key IDs or the filter with the excluded IDs and the expected count, plus translation parameters.</param>
        /// <returns>A <see cref="BulkKeyActionResponse"/>: 400 TOO_MANY_KEYS, 409 KEY_SET_CHANGED or 503 QUERY_TIMEOUT
        /// under Errors["Target"] when the target can't be acted on.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::translatekeys")]
        public async Task<IActionResult> TranslateKeys(TranslateBlocksLanguageKeysRequest request)
        {
            if (request == null) return BadRequest(new BaseMutationResponse());

            var validationResult = await _translateBlocksLanguageKeysRequestValidator.ValidateAsync(request);
            if (!validationResult.IsValid) return BadRequest(ToValidationResponse(validationResult));

            try
            {
                return Ok(await _keyManagementService.SendTranslateBlocksLanguageKeysEvent(request));
            }
            catch (BulkKeyTargetException ex)
            {
                return StatusCode(ex.StatusCode, ex.ToResponse());
            }
            catch (KeyListException ex)
            {
                return StatusCode(ex.StatusCode, ToBulkTargetError(ex));
            }
        }

        /// <summary>
        /// Imports a UILM file. Existing keys are updated. Existing modules are not replaced. New keys are added; removed keys are ignored.
        /// </summary>
        /// <param name="request">The request containing the UILM file data and project key.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the import operation.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::uilmimport")]
        public async Task<IActionResult> UilmImport([FromBody] UilmImportRequest request)
        {
            if (request == null) return BadRequest(new BaseMutationResponse());
            
            await _keyManagementService.SendUilmImportEvent(request);
            return Ok(new BaseMutationResponse { IsSuccess = true });
        }

        /// <summary>
        /// Exports all modules or selected ones with their keys.
        /// </summary>
        /// <param name="request">The request containing the project key and optional module selection for export.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the export operation.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::uilmexport")]
        public async Task<IActionResult> UilmExport([FromBody] UilmExportRequest request)
        {

            if (request == null) return BadRequest(new BaseMutationResponse());
            

            await _keyManagementService.SendUilmExportEvent(request);
            return Ok(new BaseMutationResponse { IsSuccess = true });
        }

        /// <summary>
        /// Deletes entire key collections. (Admin use only; to be removed from public API.)
        /// </summary>
        /// <param name="request">The request containing the list of collections to delete.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the delete operation.</returns>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::key::deletecollections")]
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
        [ProtectedEndPoint($"{Constants.ServiceName}::key::getuilmexportedfiles")]
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
        [ProtectedEndPoint($"{Constants.ServiceName}::key::getlanguagefilegenerationhistory")]
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
