using Blocks.Genesis;
using ClosedXML.Excel;
using DomainService.Storage;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared.Events;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using System.Reflection;
using System.Text;
using Xunit;
using BlocksLanguageKey = Eurolm.DomainService.Repositories.BlocksLanguageKey;
using KeyModel = Eurolm.DomainService.Services.Key;

namespace XUnitTest
{
    public class KeyManagementServiceImportExportTests
    {
        private readonly Mock<IKeyRepository> _keyRepositoryMock;
        private readonly Mock<IKeyTimelineRepository> _keyTimelineRepositoryMock;
        private readonly Mock<ILanguageFileGenerationHistoryRepository> _lfgHistoryMock;
        private readonly Mock<IValidator<KeyModel>> _validatorMock;
        private readonly Mock<ILanguageManagementService> _languageServiceMock;
        private readonly Mock<IModuleManagementService> _moduleServiceMock;
        private readonly Mock<IMessageClient> _messageClientMock;
        private readonly Mock<IAssistantService> _assistantServiceMock;
        private readonly Mock<IStorageDriverService> _storageDriverServiceMock;
        private readonly Mock<IServiceProvider> _serviceProviderMock;
        private readonly StorageHelper _storageHelper;
        private readonly Mock<INotificationService> _notificationServiceMock;
        private readonly Mock<IGlossaryRepository> _glossaryRepositoryMock;
        private readonly KeyManagementService _service;

        public KeyManagementServiceImportExportTests()
        {
            XUnitTest.Shared.TestBlocksContext.Set("proj");
            _keyRepositoryMock = new Mock<IKeyRepository>();
            _keyTimelineRepositoryMock = new Mock<IKeyTimelineRepository>();
            _lfgHistoryMock = new Mock<ILanguageFileGenerationHistoryRepository>();
            _validatorMock = new Mock<IValidator<KeyModel>>();
            _languageServiceMock = new Mock<ILanguageManagementService>();
            _moduleServiceMock = new Mock<IModuleManagementService>();
            _messageClientMock = new Mock<IMessageClient>();
            _assistantServiceMock = new Mock<IAssistantService>();
            _storageDriverServiceMock = new Mock<IStorageDriverService>();
            _serviceProviderMock = new Mock<IServiceProvider>();
            var storageLoggerMock = new Mock<ILogger<StorageHelper>>();
            _storageHelper = new StorageHelper(storageLoggerMock.Object, _storageDriverServiceMock.Object);
            _notificationServiceMock = new Mock<INotificationService>();
            _glossaryRepositoryMock = new Mock<IGlossaryRepository>();

            _service = new KeyManagementService(
                _keyRepositoryMock.Object,
                _keyTimelineRepositoryMock.Object,
                _lfgHistoryMock.Object,
                _validatorMock.Object,
                new Mock<ILogger<KeyManagementService>>().Object,
                _languageServiceMock.Object,
                _moduleServiceMock.Object,
                _messageClientMock.Object,
                _assistantServiceMock.Object,
                _storageDriverServiceMock.Object,
                _storageHelper,
                _serviceProviderMock.Object,
                _notificationServiceMock.Object,
                _glossaryRepositoryMock.Object
            );
        }

        private static MethodInfo GetInstanceMethod(string name)
            => typeof(KeyManagementService).GetMethod(name, BindingFlags.NonPublic | BindingFlags.Instance)!;

        private Task<bool> InvokeImport(string methodName, Stream stream, FileResponse fileData)
            => (Task<bool>)GetInstanceMethod(methodName).Invoke(_service, new object[] { stream, fileData })!;

        private static FileResponse File(string name)
            => new FileResponse { Name = name, ItemId = "file-1", Url = "https://example.test/file" };

        private static MemoryStream BuildXlsx(bool includeKeyNameColumn = true, bool includeRows = true)
        {
            using var workbook = new XLWorkbook();
            var ws = workbook.AddWorksheet("Sheet1");
            ws.Cell(1, 1).Value = "ItemId";
            ws.Cell(1, 2).Value = "ModuleId";
            ws.Cell(1, 3).Value = "Module";
            ws.Cell(1, 4).Value = includeKeyNameColumn ? "KeyName" : "NotKeyName";
            ws.Cell(1, 5).Value = "en-US";
            ws.Cell(1, 6).Value = "de-DE";

            if (includeRows)
            {
                ws.Cell(2, 1).Value = "existing-id";
                ws.Cell(2, 2).Value = "module-1";
                ws.Cell(2, 3).Value = "auth";
                ws.Cell(2, 4).Value = "welcome";
                ws.Cell(2, 5).Value = "Welcome";
                ws.Cell(2, 6).Value = "Willkommen";
            }

            var ms = new MemoryStream();
            workbook.SaveAs(ms);
            ms.Position = 0;
            return ms;
        }

        // ---- TranslateBlocksLanguageKeys (public) ----

        [Fact]
        public async Task TranslateBlocksLanguageKeys_WithMissingResources_TranslatesAndUpdates()
        {
            _languageServiceMock.Setup(s => s.GetLanguagesAsync())
                .ReturnsAsync(new List<Language>
                {
                    new() { LanguageCode = "en-US", LanguageName = "English" },
                    new() { LanguageCode = "de-DE", LanguageName = "German" }
                });

            var resourceKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                KeyName = "welcome",
                ModuleId = "module-1",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Welcome" },
                    new Resource { Culture = "de-DE", Value = "" }
                }
            };

            _keyRepositoryMock.Setup(r => r.GetUilmResourceKey(
                    It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(),
                    It.IsAny<string>()))
                .ReturnsAsync(resourceKey);
            _assistantServiceMock.Setup(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()))
                .ReturnsAsync("Willkommen");
            _keyRepositoryMock.Setup(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()))
                .ReturnsAsync(1L);

            var request = new TranslateBlocksLanguageKeysEvent
            {
                MessageCoRelationId = "corr-1",
                DefaultLanguage = "en-US",
                KeyIds = new List<string> { "key-1" },
                OperationId = "op-1"
            };

            var result = await _service.TranslateBlocksLanguageKeys(request);

            result.Should().BeTrue();
            _assistantServiceMock.Verify(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()), Times.AtLeastOnce);
            _keyRepositoryMock.Verify(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()), Times.Once);
        }

        [Fact]
        public async Task TranslateBlocksLanguageKeys_KeyNotFound_SkipsWithoutUpdate()
        {
            _languageServiceMock.Setup(s => s.GetLanguagesAsync())
                .ReturnsAsync(new List<Language> { new() { LanguageCode = "en-US", LanguageName = "English" } });
            _keyRepositoryMock.Setup(r => r.GetUilmResourceKey(
                    It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(),
                    It.IsAny<string>()))
                .ReturnsAsync((BlocksLanguageKey?)null);

            var request = new TranslateBlocksLanguageKeysEvent
            {
                MessageCoRelationId = "corr-1",
                DefaultLanguage = "en-US",
                KeyIds = new List<string> { "missing" },
                OperationId = "op-1"
            };

            var result = await _service.TranslateBlocksLanguageKeys(request);

            result.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()), Times.Never);
        }

        [Fact]
        public async Task TranslateBlocksLanguageKeys_WhenRepositoryThrows_ReturnsFalse()
        {
            _languageServiceMock.Setup(s => s.GetLanguagesAsync())
                .ThrowsAsync(new InvalidOperationException("boom"));

            var request = new TranslateBlocksLanguageKeysEvent
            {
                MessageCoRelationId = "corr-1",
                DefaultLanguage = "en-US",
                KeyIds = new List<string> { "key-1" },
                OperationId = "op-1"
            };

            var result = await _service.TranslateBlocksLanguageKeys(request);

            result.Should().BeFalse();
        }

        // ---- ImportExcelFile / ProcessExcelCells (private) ----

        [Fact]
        public async Task ImportExcelFile_NewKey_InsertsAndReturnsTrue()
        {
            _moduleServiceMock.Setup(m => m.GetModulesAsync())
                .ReturnsAsync(new List<BlocksLanguageModule>());
            _keyRepositoryMock.Setup(r => r.GetUilmResourceKey(
                    It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(),
                    It.IsAny<string>()))
                .ReturnsAsync((BlocksLanguageKey?)null);

            using var stream = BuildXlsx();
            var result = await InvokeImport("ImportExcelFile", stream, File("uilm.xlsx"));

            result.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.InsertUilmResourceKeys(
                It.Is<IEnumerable<BlocksLanguageKey>>(k => k.Any(x => x.KeyName == "welcome")),
                It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task ImportExcelFile_ExistingKey_UpdatesAndReturnsTrue()
        {
            _moduleServiceMock.Setup(m => m.GetModulesAsync())
                .ReturnsAsync(new List<BlocksLanguageModule>
                {
                    new() { ItemId = "module-1", ModuleName = "auth" }
                });
            _keyRepositoryMock.Setup(r => r.GetUilmResourceKey(
                    It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(),
                    It.IsAny<string>()))
                .ReturnsAsync(new BlocksLanguageKey { ItemId = "existing-id", KeyName = "welcome", ModuleId = "module-1" });
            _keyRepositoryMock.Setup(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()))
                .ReturnsAsync(1L);

            using var stream = BuildXlsx();
            var result = await InvokeImport("ImportExcelFile", stream, File("uilm.xlsx"));

            result.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.UpdateUilmResourceKeysForChangeAll(
                It.Is<List<BlocksLanguageKey>>(k => k.Any(x => x.ItemId == "existing-id"))), Times.Once);
        }

        [Fact]
        public async Task ImportExcelFile_MissingRequiredColumn_ReturnsFalse()
        {
            using var stream = BuildXlsx(includeKeyNameColumn: false);
            var result = await InvokeImport("ImportExcelFile", stream, File("uilm.xlsx"));

            result.Should().BeFalse();
            _keyRepositoryMock.Verify(r => r.InsertUilmResourceKeys(
                It.IsAny<IEnumerable<BlocksLanguageKey>>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task ImportExcelFile_CorruptStream_ReturnsFalse()
        {
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes("this is not a workbook"));
            var result = await InvokeImport("ImportExcelFile", stream, File("uilm.xlsx"));

            result.Should().BeFalse();
        }

        // ---- ImportCsvFile / ImportJsonFile (private) ----

        [Fact]
        public async Task ImportCsvFile_ValidCsv_ImportsAndReturnsTrue()
        {
            _keyRepositoryMock.Setup(r => r.GetUilmApplications<BlocksLanguageModule>(
                    It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageModule, bool>>>()))
                .ReturnsAsync(new List<BlocksLanguageModule>());
            _keyRepositoryMock.Setup(r => r.GetUilmResourceKey(
                    It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(),
                    It.IsAny<string>()))
                .ReturnsAsync((BlocksLanguageKey?)null);

            var csv = "ItemId,ModuleId,Module,KeyName,en-US,en-US_CharacterLength,de-DE,de-DE_CharacterLength\n" +
                      "1,m1,auth,hello,Hello,5,Hallo,5\n";
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

            var result = await InvokeImport("ImportCsvFile", stream, File("uilm.csv"));

            result.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.InsertUilmResourceKeys(
                It.Is<IEnumerable<BlocksLanguageKey>>(k => k.Any(x => x.KeyName == "hello")),
                It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task ImportCsvFile_CorruptStream_ReturnsFalse()
        {
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(""));
            var result = await InvokeImport("ImportCsvFile", stream, File("uilm.csv"));
            result.Should().BeFalse();
        }

        [Fact]
        public async Task ImportJsonFile_ValidJson_ImportsAndReturnsTrue()
        {
            _keyRepositoryMock.Setup(r => r.GetUilmApplications<BlocksLanguageModule>(
                    It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageModule, bool>>>()))
                .ReturnsAsync(new List<BlocksLanguageModule>());
            _keyRepositoryMock.Setup(r => r.GetUilmResourceKey(
                    It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(),
                    It.IsAny<string>()))
                .ReturnsAsync((BlocksLanguageKey?)null);

            var json = "[{\"_id\":\"1\",\"Module\":\"auth\",\"ModuleId\":\"m1\",\"KeyName\":\"hello\"," +
                       "\"Resources\":[{\"Culture\":\"en-US\",\"Value\":\"Hello\"}]}]";
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(json));

            var result = await InvokeImport("ImportJsonFile", stream, File("uilm.json"));

            result.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.InsertUilmResourceKeys(
                It.Is<IEnumerable<BlocksLanguageKey>>(k => k.Any(x => x.KeyName == "hello")),
                It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task ImportJsonFile_CorruptStream_ReturnsFalse()
        {
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes("{ not json"));
            var result = await InvokeImport("ImportJsonFile", stream, File("uilm.json"));
            result.Should().BeFalse();
        }

        // ---- ImportXlfFile (private) ----

        private const string BaseXlf = @"<?xml version=""1.0"" encoding=""utf-8""?>
<xliff version=""1.2"" xmlns=""urn:oasis:names:tc:xliff:document:1.2"">
  <file source-language=""en"" original=""auth"">
    <body>
      <trans-unit id=""1"">
        <source>Hello</source>
      </trans-unit>
    </body>
  </file>
</xliff>";

        [Fact]
        public async Task ImportXlfFile_ValidBaseFile_ImportsAndReturnsTrue()
        {
            _languageServiceMock.Setup(s => s.GetLanguagesAsync())
                .ReturnsAsync(new List<Language> { new() { LanguageCode = "en-US", LanguageName = "English" } });
            _keyRepositoryMock.Setup(r => r.GetUilmApplications<BlocksLanguageModule>(
                    It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageModule, bool>>>()))
                .ReturnsAsync(new List<BlocksLanguageModule>());
            _keyRepositoryMock.Setup(r => r.GetUilmResourceKeys(
                    It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(),
                    It.IsAny<string>()))
                .ReturnsAsync(new List<BlocksLanguageKey>());
            _keyRepositoryMock.Setup(r => r.UpsertResourceKeysWithMergeAsync(
                    It.IsAny<IEnumerable<BlocksLanguageKey>>(), It.IsAny<string?>()))
                .ReturnsAsync((1L, 0L));

            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(BaseXlf));
            var result = await InvokeImport("ImportXlfFile", stream, File("messages.xlf"));

            result.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.UpsertResourceKeysWithMergeAsync(
                It.IsAny<IEnumerable<BlocksLanguageKey>>(), It.IsAny<string?>()), Times.Once);
        }

        [Fact]
        public async Task ImportXlfFile_InvalidFileName_ReturnsFalse()
        {
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(BaseXlf));
            var result = await InvokeImport("ImportXlfFile", stream, File("random.xlf"));

            result.Should().BeFalse();
            _keyRepositoryMock.Verify(r => r.UpsertResourceKeysWithMergeAsync(
                It.IsAny<IEnumerable<BlocksLanguageKey>>(), It.IsAny<string?>()), Times.Never);
        }

        [Fact]
        public async Task ImportXlfFile_UnmappedLanguage_ReturnsFalse()
        {
            _languageServiceMock.Setup(s => s.GetLanguagesAsync())
                .ReturnsAsync(new List<Language> { new() { LanguageCode = "en-US", LanguageName = "English" } });

            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(BaseXlf));
            var result = await InvokeImport("ImportXlfFile", stream, File("messages.zz.xlf"));

            result.Should().BeFalse();
        }

        // ---- ImportUilmFile (public dispatch) ----

        [Fact]
        public async Task ImportUilmFile_FileNotFound_ReturnsFalse()
        {
            _storageDriverServiceMock.Setup(s => s.GetUrlForDownloadFileAsync(It.IsAny<GetFileRequest>()))
                .ReturnsAsync((FileResponse?)null);

            var result = await _service.ImportUilmFile(new UilmImportEvent
            {
                FileId = "missing",
                ProjectKey = "proj"
            });

            result.Should().BeFalse();
        }

        // ---- GetLanguageStreamMapFromTemplate (private) ----

        [Fact]
        public async Task GetLanguageStreamMapFromTemplate_ProducesOneStreamPerLanguage()
        {
            var template = @"<?xml version=""1.0"" encoding=""utf-8""?>
<xliff version=""1.2"" xmlns=""urn:oasis:names:tc:xliff:document:1.2"">
  <file source-language=""en"" original=""auth"">
    <body>
      <trans-unit id=""1"">
        <source>Hello</source>
        <target>Hello</target>
      </trans-unit>
    </body>
  </file>
</xliff>";
            using var referenceStream = new MemoryStream(Encoding.UTF8.GetBytes(template));
            var resourceKeys = new List<BlocksLanguageKey>
            {
                new()
                {
                    KeyName = "Hello",
                    Resources = new[]
                    {
                        new Resource { Culture = "de-DE", Value = "Hallo" },
                        new Resource { Culture = "fr-FR", Value = "Bonjour" }
                    }
                }
            };
            var languages = new List<string> { "de-DE", "fr-FR" };

            var method = GetInstanceMethod("GetLanguageStreamMapFromTemplate");
            var task = (Task<Dictionary<string, MemoryStream>>)method.Invoke(
                _service, new object[] { languages, referenceStream, resourceKeys })!;
            var map = await task;

            map.Should().ContainKey("messages.de.xlf");
            map.Should().ContainKey("messages.fr.xlf");
            map["messages.de.xlf"].Length.Should().BeGreaterThan(0);
        }
    }
}
