using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared.DTOs;
using FluentAssertions;
using Xunit;

namespace XUnitTest
{
    public class LanguageManagerDtoTests
    {
        [Fact]
        public void Properties_CanBeAssignedAndRead()
        {
            var resourceKey = new BlocksLanguageKey
            {
                KeyName = "welcome",
                ModuleId = "module-1",
                Value = "Welcome",
                Resources = new[]
                {
                    new Resource
                    {
                        Culture = "en",
                        Value = "Welcome"
                    }
                },
                Routes = new List<string> { "/home" },
                Context = "Greeting",
                IsPartiallyTranslated = false
            };

            var module = new BlocksLanguageModule
            {
                ModuleName = "Dashboard",
                Name = "Dashboard Module"
            };

            var dto = new LanguageManagerDto
            {
                UilmResourceKey = resourceKey,
                UilmApplication = module
            };

            dto.UilmResourceKey.Should().BeSameAs(resourceKey);
            dto.UilmApplication.Should().BeSameAs(module);
            dto.UilmResourceKey.KeyName.Should().Be("welcome");
            dto.UilmApplication.ModuleName.Should().Be("Dashboard");
        }

        [Fact]
        public void Properties_CanBeSetToNull_WhenUsingNullForgiving()
        {
            var dto = new LanguageManagerDto
            {
                UilmResourceKey = null!,
                UilmApplication = null!
            };

            dto.UilmResourceKey.Should().BeNull();
            dto.UilmApplication.Should().BeNull();
        }
    }
}
