namespace BlocksTemplate.DomainService.Services
{
    public interface IAssistantService
    {
        Task<string> AiCompletion(AiCompletionRequest request);
        Task<string> SuggestTranslation(SuggestLanguageRequest query);
    }
}
