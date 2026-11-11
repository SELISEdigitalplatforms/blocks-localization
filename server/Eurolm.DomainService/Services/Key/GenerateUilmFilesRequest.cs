using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GenerateUilmFilesRequest 
    {
        public string Guid { get; set; }
        public string? ModuleId { get; set; }
        public string? ProjectKey { get; set; }

        /// <summary>Upload every file of the published modules even when its content is unchanged.</summary>
        public bool ForceUpload { get; set; }
    }
    public class GenerateUilmRequest
    {
        public string Guid { get; set; }
        public string? ModuleId { get; set; }

        /// <summary>Optional; false keeps today's behaviour of skipping unchanged files.</summary>
        public bool ForceUpload { get; set; }
    }
}
