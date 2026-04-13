using Blocks.Genesis;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared;
using Microsoft.AspNetCore.Mvc;

namespace BlocksTemplate.Api.Controllers
{
    /// <summary>
    /// API Controller for managing language-related operations.
    /// </summary>
    
    [ApiController]
    [Route("[controller]/[action]")]

    public class LanguageController : ControllerBase
    {
        private readonly ILanguageManagementService _languageManagementService;
        private readonly ChangeControllerContext _changeControllerContext;

        /// <summary>
        /// Initializes a new instance of the <see cref="LanguageController"/> class.
        /// </summary>
        /// <param name="languageManagementService">The service used for managing languages.</param>

        public LanguageController(
            ILanguageManagementService languageManagementService,
            ChangeControllerContext changeControllerContext)
        {
            _languageManagementService = languageManagementService;
            _changeControllerContext = changeControllerContext;
        }

        /// <summary>
        /// Saves a new or existing language.
        /// </summary>
        /// <param name="language">The language object to be saved.</param>
        /// <returns>An <see cref="ApiResponse"/> indicating the success or failure of the operation.</returns>
        

        [HttpPost]
        [ProtectedEndPoint]
        public async Task<ApiResponse> Save(Language language)
        {
            if (language == null) BadRequest(new BaseMutationResponse());
            _changeControllerContext.ChangeContext(language);
            return await _languageManagementService.SaveLanguageAsync(language);
        }

        /// <summary>
        /// Retrieves all available languages.
        /// </summary>
        /// <returns>A list of <see cref="Language"/> objects.</returns>
        
        [HttpGet]
        public async Task<List<Language>> Gets([FromQuery] GetLanguagesRequest request)
        {
            if (request == null) BadRequest(new BaseMutationResponse());
            _changeControllerContext.ChangeContext(request);
            return await _languageManagementService.GetLanguagesAsync();
        }

        /// <summary>
        /// Deletes a specific language.
        /// </summary>
        /// <param name="request">The request containing the language name to delete.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the delete operation.</returns>
        [HttpDelete]
        [ProtectedEndPoint]
        public async Task<IActionResult> Delete([FromQuery] DeleteLanguageRequest request)
        {
            if (request == null) BadRequest(new BaseMutationResponse());
            _changeControllerContext.ChangeContext(request);

            if (string.IsNullOrWhiteSpace(request.LanguageName))
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "LanguageName", "Invalid or missing LanguageName" }
                    }
                });
            }

            var result = await _languageManagementService.DeleteAsysnc(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Sets the default language.
        /// </summary>
        /// <param name="request">The request containing the language name to set as default.</param>
        /// <returns>An <see cref="IActionResult"/> indicating the success or failure of the operation.</returns>
        [HttpPost]
        [ProtectedEndPoint]
        public async Task<IActionResult> SetDefault(SetDefaultLanguageRequest request)
        {
            if (request == null) BadRequest(new BaseMutationResponse());
            _changeControllerContext.ChangeContext(request);

            if (string.IsNullOrWhiteSpace(request.LanguageName))
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "LanguageName", "Invalid or missing LanguageName" }
                    }
                });
            }

            var result = await _languageManagementService.SetDefaultLanguage(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }
    }
}
