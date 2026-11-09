namespace Eurolm.DomainService.Services
{
    public interface IAssistantService
    {
        Task<string> AiCompletion(AiCompletionRequest request);
        Task<SuggestionResult> SuggestTranslation(SuggestLanguageRequest query);
        /// <summary>Fills a blank ElementApplicationContext from the description of the request's module.</summary>
        Task ApplyModuleContextAsync(SuggestLanguageRequest query);
    }
}
