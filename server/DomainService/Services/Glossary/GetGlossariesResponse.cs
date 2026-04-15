namespace BlocksTemplate.DomainService.Services
{
    public class GetGlossariesResponse
    {
        public List<Glossary> Items { get; set; } = new();
        public long TotalCount { get; set; }
    }
}
