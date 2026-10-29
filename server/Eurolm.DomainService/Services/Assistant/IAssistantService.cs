namespace Eurolm.DomainService.Services
{
    public interface IAssistantService
    {
        Task<string> AiCompletion(AiCompletionRequest request);
        Task<SuggestionResult> SuggestTranslation(SuggestLanguageRequest query);
    }
}
