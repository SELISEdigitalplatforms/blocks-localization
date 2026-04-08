using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Services.HelperService;
using BlocksTemplate.DomainService.Shared.Entities;
using BlocksTemplate.DomainService.Shared.Events;
using DomainService.Storage;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using System.Reflection;
using System.Text;
using Xunit;
using KeyModel = BlocksTemplate.DomainService.Services.Key;

namespace BlocksTemplate.XUnitTest
{
    public class KeyManagementServicePrivateTests
    {
        private readonly KeyManagementService _service;

        public KeyManagementServicePrivateTests()
        {
            var keyRepositoryMock = new Mock<IKeyRepository>();
            var keyTimelineRepositoryMock = new Mock<IKeyTimelineRepository>();
            var languageFileGenerationHistoryRepositoryMock = new Mock<ILanguageFileGenerationHistoryRepository>();
            var validatorMock = new Mock<FluentValidation.IValidator<KeyModel>>();
            var loggerMock = new Mock<ILogger<KeyManagementService>>();
            var languageServiceMock = new Mock<ILanguageManagementService>();
            var moduleServiceMock = new Mock<IModuleManagementService>();
            var messageClientMock = new Mock<IMessageClient>();
            var assistantServiceMock = new Mock<IAssistantService>();
            var storageDriverServiceMock = new Mock<IStorageDriverService>();
            var notificationServiceMock = new Mock<INotificationService>();
            var storageLogger = new Mock<ILogger<StorageHelper>>();
            var storageHelper = new StorageHelper(storageLogger.Object, storageDriverServiceMock.Object);

            // Storage mock to exercise ImportUilmFile early null branch
            storageDriverServiceMock.Setup(s => s.GetUrlForDownloadFileAsync(It.IsAny<GetFileRequest>()))
                .ReturnsAsync((FileResponse)null);

            _service = new KeyManagementService(
                keyRepositoryMock.Object,
                keyTimelineRepositoryMock.Object,
                languageFileGenerationHistoryRepositoryMock.Object,
                validatorMock.Object,
                loggerMock.Object,
                languageServiceMock.Object,
                moduleServiceMock.Object,
                messageClientMock.Object,
                assistantServiceMock.Object,
                storageDriverServiceMock.Object,
                storageHelper,
                Mock.Of<IServiceProvider>(),
                notificationServiceMock.Object
            );
        }

        [Fact]
        public void ExtractModelsFromJson_ParsesLanguages()
        {
            var json = "[{\"_id\":\"1\",\"ModuleId\":\"m1\",\"Module\":\"auth\",\"KeyName\":\"hello\",\"IsPartiallyTranslated\":false,\"Resources\":[{\"Culture\":\"en-US\",\"Value\":\"Hello\"}]}]";
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(json));

            var method = typeof(KeyManagementService)
                .GetMethod("ExtractModelsFromJson", BindingFlags.NonPublic | BindingFlags.Static);

            var result = method.Invoke(null, new object[] { stream }) as List<LanguageJsonModel>;

            result.Should().NotBeNull();
            result!.Count.Should().Be(1);
            result[0].KeyName.Should().Be("hello");
            result[0].Resources.Should().HaveCount(1);
        }

        [Fact]
        public void ExtractModelsFromCsv_ParsesRowsWithCharacterLength()
        {
            var csv = "ItemId,ModuleId,Module,KeyName,en-US,en-US_CharacterLength\n" +
                      "1,m1,auth,hello,Hello,5\n";
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

            var method = typeof(KeyManagementService)
                .GetMethod("ExtractModelsFromCsv", BindingFlags.NonPublic | BindingFlags.Static);

            var result = method.Invoke(null, new object[] { stream }) as List<LanguageJsonModel>;

            result.Should().NotBeNull();
            result!.Count.Should().Be(1);
            result[0].Resources.Should().HaveCount(1);
            result[0].Resources[0].CharacterLength.Should().Be(5);
        }

        [Fact]
        public void AssignToDictionary_NestsKeysProperly()
        {
            var dictionary = new Dictionary<string, object>();
            var method = typeof(KeyManagementService)
                .GetMethod("AssignToDictionary", BindingFlags.NonPublic | BindingFlags.Instance);

            method.Invoke(_service, new object[] { dictionary, "a.b.c", "value" });

            dictionary.Should().ContainKey("a");
            var nested = dictionary["a"] as Dictionary<string, object>;
            nested.Should().NotBeNull();
            (nested!["b"] as Dictionary<string, object>).Should().ContainKey("c");
        }

        [Fact]
        public async Task ImportUilmFile_ReturnsFalseWhenFileMissing()
        {
            var request = new UilmImportEvent
            {
                FileId = "missing",
                ProjectKey = "proj"
            };

            var result = await _service.ImportUilmFile(request);

            result.Should().BeFalse();
        }
    }
}

