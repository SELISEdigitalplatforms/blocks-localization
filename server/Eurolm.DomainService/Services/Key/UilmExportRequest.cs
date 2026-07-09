using Blocks.Genesis;
using Eurolm.DomainService.Shared.Utilities;

namespace Eurolm.DomainService.Services
{
    public class UilmExportRequest 
    {
        /// <summary>
        /// command. OutputType: The type of output for the file contents when exporting the zip file. Types include Json, Xml, Text.
        /// </summary>
        public OutputType OutputType { get; set; }
        /// <summary>
        /// command. MessageCoRelationId: This isused to intercept notification from the frontend.
        /// </summary>
        public string MessageCoRelationId { get; set; }

        public List<string> AppIds { get; set; } = null;
        public List<string> Languages { get; set; }
        public string ReferenceFileId { get; set; }
        public string CallerTenantId { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }
}
