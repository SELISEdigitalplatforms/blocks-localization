using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared;
using BlocksTemplate.DomainService.Shared.Entities;
using FluentAssertions;
using Xunit;

namespace XUnitTest
{
    public class KeyModelTests
    {
        [Fact]
        public void Key_Properties_SetCorrectly()
        {
            var key = new Key
            {
                ItemId = "id-1",
                KeyName = "welcome",
                ModuleId = "mod-1",
                Resources = new[] { new Resource { Culture = "en", Value = "Hello", CharacterLength = 5 } },
                Routes = new List<string> { "/home" },
                IsPartiallyTranslated = true,
                IsNewKey = true,
                LastUpdateDate = DateTime.UtcNow,
                CreateDate = DateTime.UtcNow,
                Context = "Homepage greeting",
                ShouldPublish = true,
                ProjectKey = "proj-1"
            };

            key.ItemId.Should().Be("id-1");
            key.KeyName.Should().Be("welcome");
            key.ModuleId.Should().Be("mod-1");
            key.Resources.Should().HaveCount(1);
            key.Routes.Should().Contain("/home");
            key.IsPartiallyTranslated.Should().BeTrue();
            key.IsNewKey.Should().BeTrue();
            key.Context.Should().Be("Homepage greeting");
            key.ShouldPublish.Should().BeTrue();
            key.ProjectKey.Should().Be("proj-1");
        }

        [Fact]
        public void Key_ImplementsIProjectKey()
        {
            var key = new Key { ProjectKey = "test" };
            key.Should().BeAssignableTo<IProjectKey>();
        }
    }

    public class ResourceModelTests
    {
        [Fact]
        public void Resource_Properties_SetCorrectly()
        {
            var resource = new Resource
            {
                Value = "Hello",
                Culture = "en-US",
                CharacterLength = 5
            };

            resource.Value.Should().Be("Hello");
            resource.Culture.Should().Be("en-US");
            resource.CharacterLength.Should().Be(5);
        }
    }

    public class KeyTimelineModelTests
    {
        [Fact]
        public void KeyTimeline_Properties_SetCorrectly()
        {
            var timeline = new KeyTimeline
            {
                ItemId = "t1",
                EntityId = "e1",
                UserId = "u1",
                UserName = "John Doe",
                LogFrom = "api",
                RollbackFrom = null
            };

            timeline.ItemId.Should().Be("t1");
            timeline.EntityId.Should().Be("e1");
            timeline.UserId.Should().Be("u1");
            timeline.UserName.Should().Be("John Doe");
            timeline.LogFrom.Should().Be("api");
            timeline.RollbackFrom.Should().BeNull();
        }

        [Fact]
        public void KeyTimeline_DefaultValues_AreSet()
        {
            var timeline = new KeyTimeline();
            timeline.ItemId.Should().NotBeNullOrWhiteSpace();
            timeline.CreateDate.Should().NotBe(default);
        }
    }

    public class UilmFileModelTests
    {
        [Fact]
        public void UilmFile_Properties_SetCorrectly()
        {
            var file = new UilmFile
            {
                Id = "file-1",
                TenantId = "tenant-1",
                ModuleName = "auth",
                Language = "en-US",
                Content = "{}"
            };

            file.Id.Should().Be("file-1");
            file.TenantId.Should().Be("tenant-1");
            file.ModuleName.Should().Be("auth");
            file.Language.Should().Be("en-US");
            file.Content.Should().Be("{}");
        }
    }

    public class OutputGeneratorBaseTests
    {
        [Fact]
        public async Task OutputGenerator_VirtualGenerateAsync_DelegatesToAbstractOverload()
        {
            // Test that the base class virtual method with referenceTranslations calls the abstract method
            var generator = new JsonOutputGeneratorService();
            var languages = new List<BlocksLanguage>();
            var modules = new List<BlocksLanguageModule>();
            var keys = new List<BlocksLanguageKey>();

            var result = await generator.GenerateAsync<string>(
                languages, modules, keys, "en-US",
                new Dictionary<string, Dictionary<string, string>>());

            result.Should().NotBeNull();
            result.Should().Contain("[]");
        }
    }

    public class GetKeysRequestModelTests
    {
        [Fact]
        public void GetKeysRequest_Properties_SetCorrectly()
        {
            var request = new GetKeysRequest
            {
                PageSize = 20,
                PageNumber = 2,
                KeySearchText = "test",
                ModuleIds = new[] { "mod-1", "mod-2" },
                IsPartiallyTranslated = true,
                CreateDateRange = new DateRange
                {
                    StartDate = DateTime.UtcNow.AddDays(-7),
                    EndDate = DateTime.UtcNow
                },
                SortProperty = "KeyName",
                IsDescending = true,
                ProjectKey = "proj-1"
            };

            request.PageSize.Should().Be(20);
            request.PageNumber.Should().Be(2);
            request.KeySearchText.Should().Be("test");
            request.ModuleIds.Should().HaveCount(2);
            request.IsPartiallyTranslated.Should().BeTrue();
            request.CreateDateRange.Should().NotBeNull();
            request.SortProperty.Should().Be("KeyName");
            request.IsDescending.Should().BeTrue();
            request.ProjectKey.Should().Be("proj-1");
        }

        [Fact]
        public void GetKeysRequest_ImplementsIProjectKey()
        {
            var request = new GetKeysRequest { ProjectKey = "test" };
            request.Should().BeAssignableTo<IProjectKey>();
        }
    }

    public class DateRangeModelTests
    {
        [Fact]
        public void DateRange_WithNullValues_IsValid()
        {
            var range = new DateRange();
            range.StartDate.Should().BeNull();
            range.EndDate.Should().BeNull();
        }

        [Fact]
        public void DateRange_WithValues_SetsCorrectly()
        {
            var start = DateTime.UtcNow.AddDays(-7);
            var end = DateTime.UtcNow;
            var range = new DateRange { StartDate = start, EndDate = end };
            range.StartDate.Should().Be(start);
            range.EndDate.Should().Be(end);
        }
    }

    public class GetKeyTimelineRequestModelTests
    {
        [Fact]
        public void GetKeyTimelineRequest_DefaultValues_AreCorrect()
        {
            var request = new GetKeyTimelineRequest();
            request.PageSize.Should().Be(10);
            request.PageNumber.Should().Be(1);
            request.SortProperty.Should().Be("CreateDate");
            request.IsDescending.Should().BeTrue();
        }

        [Fact]
        public void GetKeyTimelineRequest_ImplementsIProjectKey()
        {
            var request = new GetKeyTimelineRequest { ProjectKey = "test" };
            request.Should().BeAssignableTo<IProjectKey>();
        }

        [Fact]
        public void GetKeyTimelineRequest_WithAllProperties_SetsCorrectly()
        {
            var request = new GetKeyTimelineRequest
            {
                PageSize = 25,
                PageNumber = 3,
                EntityId = "entity-1",
                UserId = "user-1",
                CreateDateRange = new DateRange { StartDate = DateTime.UtcNow.AddDays(-1), EndDate = DateTime.UtcNow },
                SortProperty = "LastUpdateDate",
                IsDescending = false,
                ProjectKey = "proj-1"
            };

            request.EntityId.Should().Be("entity-1");
            request.UserId.Should().Be("user-1");
            request.CreateDateRange.Should().NotBeNull();
            request.SortProperty.Should().Be("LastUpdateDate");
            request.IsDescending.Should().BeFalse();
        }
    }

    public class GetUilmExportedFilesRequestModelTests
    {
        [Fact]
        public void GetUilmExportedFilesRequest_DefaultValues_AreCorrect()
        {
            var request = new GetUilmExportedFilesRequest();
            request.PageSize.Should().Be(10);
            request.PageNumber.Should().Be(0);
        }

        [Fact]
        public void GetUilmExportedFilesRequest_ImplementsIProjectKey()
        {
            var request = new GetUilmExportedFilesRequest { ProjectKey = "test" };
            request.Should().BeAssignableTo<IProjectKey>();
        }

        [Fact]
        public void GetUilmExportedFilesRequest_WithAllProperties_SetsCorrectly()
        {
            var request = new GetUilmExportedFilesRequest
            {
                PageSize = 50,
                PageNumber = 5,
                ProjectKey = "proj-1",
                SearchText = "export",
                CreateDateRange = new DateRange { StartDate = DateTime.UtcNow.AddDays(-30), EndDate = DateTime.UtcNow }
            };

            request.SearchText.Should().Be("export");
            request.CreateDateRange.Should().NotBeNull();
        }
    }

    public class GetUilmFileRequestModelTests
    {
        [Fact]
        public void GetUilmFileRequest_Properties_SetCorrectly()
        {
            var request = new GetUilmFileRequest
            {
                Language = "en-US",
                ModuleName = "auth",
                ProjectKey = "proj-1"
            };

            request.Language.Should().Be("en-US");
            request.ModuleName.Should().Be("auth");
            request.ProjectKey.Should().Be("proj-1");
        }

        [Fact]
        public void GetUilmFileRequest_ImplementsIProjectKey()
        {
            var request = new GetUilmFileRequest { ProjectKey = "test" };
            request.Should().BeAssignableTo<IProjectKey>();
        }
    }

    public class GetKeysQueryResponseModelTests
    {
        [Fact]
        public void GetKeysQueryResponse_Properties_SetCorrectly()
        {
            var response = new GetKeysQueryResponse
            {
                TotalCount = 100,
                Keys = new List<Key> { new Key { ItemId = "k1", KeyName = "key1" } }
            };

            response.TotalCount.Should().Be(100);
            response.Keys.Should().HaveCount(1);
        }
    }

    public class GetKeysByKeyNamesResponseModelTests
    {
        [Fact]
        public void GetKeysByKeyNamesResponse_DefaultValues_AreCorrect()
        {
            var response = new GetKeysByKeyNamesResponse();
            response.Keys.Should().NotBeNull();
            response.Keys.Should().BeEmpty();
            response.ErrorMessage.Should().BeNull();
        }

        [Fact]
        public void GetKeysByKeyNamesResponse_WithError_SetsMessage()
        {
            var response = new GetKeysByKeyNamesResponse
            {
                ErrorMessage = "No keys found"
            };
            response.ErrorMessage.Should().Be("No keys found");
        }
    }

    public class GetUilmExportedFilesQueryResponseModelTests
    {
        [Fact]
        public void GetUilmExportedFilesQueryResponse_DefaultValues_AreCorrect()
        {
            var response = new GetUilmExportedFilesQueryResponse();
            response.TotalCount.Should().Be(0);
            response.UilmExportedFiles.Should().NotBeNull();
            response.UilmExportedFiles.Should().BeEmpty();
        }
    }

    public class GetKeyTimelineQueryResponseModelTests
    {
        [Fact]
        public void GetKeyTimelineQueryResponse_DefaultValues_AreCorrect()
        {
            var response = new GetKeyTimelineQueryResponse();
            response.TotalCount.Should().Be(0);
            response.Timelines.Should().NotBeNull();
            response.Timelines.Should().BeEmpty();
        }

        [Fact]
        public void GetKeyTimelineQueryResponse_WithItems_SetsCorrectly()
        {
            var response = new GetKeyTimelineQueryResponse
            {
                TotalCount = 5,
                Timelines = new List<KeyTimeline>
                {
                    new KeyTimeline { EntityId = "e1" }
                }
            };

            response.TotalCount.Should().Be(5);
            response.Timelines.Should().HaveCount(1);
        }
    }

    public class BlocksLanguageModelTests
    {
        [Fact]
        public void BlocksLanguage_Properties_SetCorrectly()
        {
            var language = new BlocksLanguage
            {
                ItemId = "l1",
                LanguageName = "English",
                LanguageCode = "en-US",
                IsDefault = true
            };

            language.ItemId.Should().Be("l1");
            language.LanguageName.Should().Be("English");
            language.LanguageCode.Should().Be("en-US");
            language.IsDefault.Should().BeTrue();
        }
    }

    public class BlocksLanguageModuleModelTests
    {
        [Fact]
        public void BlocksLanguageModule_Properties_SetCorrectly()
        {
            var module = new BlocksLanguageModule
            {
                ItemId = "m1",
                ModuleName = "auth",
                Name = "Authentication"
            };

            module.ItemId.Should().Be("m1");
            module.ModuleName.Should().Be("auth");
            module.Name.Should().Be("Authentication");
        }
    }

    public class BlocksLanguageKeyModelTests
    {
        [Fact]
        public void BlocksLanguageKey_Properties_SetCorrectly()
        {
            var key = new BlocksLanguageKey
            {
                ItemId = "k1",
                KeyName = "welcome",
                ModuleId = "mod-1",
                Value = "Hello",
                Resources = new[] { new Resource { Culture = "en", Value = "Hello" } },
                Routes = new List<string> { "/home" },
                Context = "greeting",
                IsPartiallyTranslated = true
            };

            key.KeyName.Should().Be("welcome");
            key.Value.Should().Be("Hello");
            key.Context.Should().Be("greeting");
            key.IsPartiallyTranslated.Should().BeTrue();
        }
    }

    public class BaseEntityModelTests
    {
        [Fact]
        public void BaseEntity_Properties_SetCorrectly()
        {
            var entity = new BlocksLanguage
            {
                ItemId = "id-1",
                CreateDate = DateTime.UtcNow,
                LastUpdateDate = DateTime.UtcNow,
                CreatedBy = "user-1",
                LastUpdatedBy = "user-2",
                TenantId = "tenant-1"
            };

            entity.CreatedBy.Should().Be("user-1");
            entity.LastUpdatedBy.Should().Be("user-2");
            entity.TenantId.Should().Be("tenant-1");
        }
    }

    public class UilmExportedFileModelTests
    {
        [Fact]
        public void UilmExportedFile_Properties_SetCorrectly()
        {
            var file = new UilmExportedFile
            {
                FileId = "f1",
                FileName = "export.json",
                CreateDate = DateTime.UtcNow,
                CreatedBy = "user-1"
            };

            file.FileId.Should().Be("f1");
            file.FileName.Should().Be("export.json");
            file.CreatedBy.Should().Be("user-1");
        }
    }

    public class LanguageJsonModelTests
    {
        [Fact]
        public void LanguageJsonModel_Properties_SetCorrectly()
        {
            var model = new LanguageJsonModel
            {
                _id = "id-1",
                TenantId = "t1",
                ModuleId = "mod-1",
                Module = "auth",
                Routes = new List<string> { "/home" },
                KeyName = "welcome",
                IsPartiallyTranslated = false,
                Resources = new[] { new Resource { Culture = "en", Value = "Hello" } }
            };

            model._id.Should().Be("id-1");
            model.Module.Should().Be("auth");
            model.KeyName.Should().Be("welcome");
            model.Resources.Should().HaveCount(1);
        }
    }

    public class BlocksBaseTimelineEntityModelTests
    {
        [Fact]
        public void BlocksBaseTimelineEntity_DefaultValues_AreSet()
        {
            var entity = new KeyTimeline();
            entity.ItemId.Should().NotBeNullOrWhiteSpace();
            entity.CreateDate.Should().NotBe(default);
            entity.LastUpdateDate.Should().NotBe(default);
        }

        [Fact]
        public void BlocksBaseTimelineEntity_Properties_SetCorrectly()
        {
            var current = new BlocksLanguageKey { ItemId = "k1", KeyName = "key1" };
            var previous = new BlocksLanguageKey { ItemId = "k1", KeyName = "key1_old" };

            var timeline = new KeyTimeline
            {
                CurrentData = current,
                PreviousData = previous,
                LogFrom = "import",
                RollbackFrom = "r1"
            };

            timeline.CurrentData.Should().NotBeNull();
            timeline.PreviousData.Should().NotBeNull();
            timeline.LogFrom.Should().Be("import");
            timeline.RollbackFrom.Should().Be("r1");
        }
    }
}
