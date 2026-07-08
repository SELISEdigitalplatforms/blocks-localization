using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetUilmFileRequest
    {
        public string Language { get; set; }
        public string ModuleName { get; set; }

    }
    public class GetUilmFileRequestForClient
    {
        public string Language { get; set; }
        public string ModuleName { get; set; }
        public string projectKey { get; set; }

    }
}
