using BlocksTemplate.DomainService.Shared.Entities;
using FluentAssertions;

namespace XUnitTest
{
    public class BaseBlocksCommandTests
    {
        [Fact]
        public void Properties_CanBeAssignedAndRead()
        {
            var command = new BaseBlocksCommand
            {
                ClientTenantId = "tenant-1",
                OrganizationId = "org-1",
                ClientSiteId = "site-1",
                ClientEnable = true,
                IsBlocksDisable = false,
                IsExternal = false,
                DefaultLanguage = "en",
                MailServiceBaseUrl = "https://mail.service"
            };

            command.ClientTenantId.Should().Be("tenant-1");
            command.OrganizationId.Should().Be("org-1");
            command.ClientSiteId.Should().Be("site-1");
            command.ClientEnable.Should().BeTrue();
            command.IsBlocksDisable.Should().BeFalse();
            command.IsExternal.Should().BeFalse();
            command.DefaultLanguage.Should().Be("en");
            command.MailServiceBaseUrl.Should().Be("https://mail.service");
        }

        [Fact]
        public void ValidateBlocksConfig_External_WithOrganizationId_ReturnsTrue()
        {
            var command = new BaseBlocksCommand
            {
                IsExternal = true,
                OrganizationId = "org-1"
            };

            var result = command.ValidateBlocksConfig();

            result.Should().BeTrue();
        }

        [Fact]
        public void ValidateBlocksConfig_External_WithMissingOrganizationId_ReturnsFalse()
        {
            var command = new BaseBlocksCommand
            {
                IsExternal = true,
                OrganizationId = " "
            };

            var result = command.ValidateBlocksConfig();

            result.Should().BeFalse();
        }

        [Fact]
        public void ValidateBlocksConfig_Internal_WithAllRequiredFields_ReturnsTrue()
        {
            var command = new BaseBlocksCommand
            {
                IsExternal = false,
                OrganizationId = "org-1",
                ClientTenantId = "tenant-1",
                ClientSiteId = "site-1"
            };

            var result = command.ValidateBlocksConfig();

            result.Should().BeTrue();
        }

        [Fact]
        public void ValidateBlocksConfig_Internal_WithMissingClientTenantId_ReturnsFalse()
        {
            var command = new BaseBlocksCommand
            {
                IsExternal = false,
                OrganizationId = "org-1",
                ClientTenantId = string.Empty,
                ClientSiteId = "site-1"
            };

            var result = command.ValidateBlocksConfig();

            result.Should().BeFalse();
        }

        [Fact]
        public void ValidateBlocksConfig_Internal_WithMissingClientSiteId_ReturnsFalse()
        {
            var command = new BaseBlocksCommand
            {
                IsExternal = false,
                OrganizationId = "org-1",
                ClientTenantId = "tenant-1",
                ClientSiteId = null!
            };

            var result = command.ValidateBlocksConfig();

            result.Should().BeFalse();
        }

        [Fact]
        public void ValidateBlocksConfig_Internal_WithMissingOrganizationId_ReturnsFalse()
        {
            var command = new BaseBlocksCommand
            {
                IsExternal = false,
                OrganizationId = null!,
                ClientTenantId = "tenant-1",
                ClientSiteId = "site-1"
            };

            var result = command.ValidateBlocksConfig();

            result.Should().BeFalse();
        }

        [Fact]
        public void ValidateAllownece_External_BlocksEnabled_ReturnsTrue()
        {
            var command = new BaseBlocksCommand
            {
                IsExternal = true,
                IsBlocksDisable = false,
                ClientEnable = false
            };

            var result = command.ValidateAllownece();

            result.Should().BeTrue();
        }

        [Fact]
        public void ValidateAllownece_External_BlocksDisabled_ReturnsFalse()
        {
            var command = new BaseBlocksCommand
            {
                IsExternal = true,
                IsBlocksDisable = true,
                ClientEnable = true
            };

            var result = command.ValidateAllownece();

            result.Should().BeFalse();
        }

        [Fact]
        public void ValidateAllownece_Internal_ClientEnabledAndBlocksEnabled_ReturnsTrue()
        {
            var command = new BaseBlocksCommand
            {
                IsExternal = false,
                ClientEnable = true,
                IsBlocksDisable = false
            };

            var result = command.ValidateAllownece();

            result.Should().BeTrue();
        }

        [Fact]
        public void ValidateAllownece_Internal_ClientDisabled_ReturnsFalse()
        {
            var command = new BaseBlocksCommand
            {
                IsExternal = false,
                ClientEnable = false,
                IsBlocksDisable = false
            };

            var result = command.ValidateAllownece();

            result.Should().BeFalse();
        }

        [Fact]
        public void ValidateAllownece_Internal_BlocksDisabled_ReturnsFalse()
        {
            var command = new BaseBlocksCommand
            {
                IsExternal = false,
                ClientEnable = true,
                IsBlocksDisable = true
            };

            var result = command.ValidateAllownece();

            result.Should().BeFalse();
        }
    }
}
