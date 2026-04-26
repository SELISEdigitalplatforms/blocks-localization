namespace BlocksTemplate.DomainService.Shared.Entities
{
    public class BaseBlocksCommand
    {
        public string ClientTenantId { get; set; }
        public string OrganizationId { get; set; }
        public string ClientSiteId { get; set; }
        public bool ClientEnable { get; set; }
        public bool IsBlocksDisable { get; set; }
        public bool IsExternal { get; set; }
        public string DefaultLanguage { get; set; }
        public string MailServiceBaseUrl { get; set; }

        public bool ValidateBlocksConfig()
        {
            if (IsExternal) return !string.IsNullOrWhiteSpace(OrganizationId);

            return !string.IsNullOrWhiteSpace(OrganizationId)
                && !string.IsNullOrWhiteSpace(ClientTenantId)
                && !string.IsNullOrWhiteSpace(ClientSiteId);
        }

        public bool ValidateAllownece()
        {
            if (IsExternal) return !IsBlocksDisable;
            return ClientEnable && !IsBlocksDisable;
        }
    }
}
