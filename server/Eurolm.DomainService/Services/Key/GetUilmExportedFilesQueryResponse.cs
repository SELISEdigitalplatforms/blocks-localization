using Eurolm.DomainService.Repositories;

namespace Eurolm.DomainService.Services
{
    public class GetUilmExportedFilesQueryResponse
    {
        public long TotalCount { get; set; }
        public List<UilmExportedFile> UilmExportedFiles { get; set; } = new();
    }
}
