using BlocksTemplate.DomainService.Repositories;

namespace BlocksTemplate.DomainService.Services
{
    public class GetUilmExportedFilesQueryResponse
    {
        public long TotalCount { get; set; }
        public List<UilmExportedFile> UilmExportedFiles { get; set; } = new();
    }
}
