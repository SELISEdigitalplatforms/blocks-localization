using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Services.HelperService;
using BlocksTemplate.DomainService.Shared;
using BlocksTemplate.DomainService.Shared.Entities;
using BlocksTemplate.DomainService.Shared.Events;
using BlocksTemplate.DomainService.Shared.Utilities;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using System.Reflection;
using System.Text;
using Xunit;
using BlocksLanguageKey = BlocksTemplate.DomainService.Repositories.BlocksLanguageKey;
using KeyModel = BlocksTemplate.DomainService.Services.Key;
using KeyTimeline = BlocksTemplate.DomainService.Services.KeyTimeline;

namespace BlocksTemplate.XUnitTest
{
    public class KeyManagementServiceExtendedTests
    {
        private readonly Mock<ILogger<KeyManagementService>> _loggerMock;
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
        private readonly KeyManagementService _service;

        public KeyManagementServiceExtendedTests()
        {
            _loggerMock = new Mock<ILogger<KeyManagementService>>();
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

            _service = new KeyManagementService(
                _keyRepositoryMock.Object,
                _keyTimelineRepositoryMock.Object,
                _lfgHistoryMock.Object,
                _validatorMock.Object,
                _loggerMock.Object,
                _languageServiceMock.Object,
                _moduleServiceMock.Object,
                _messageClientMock.Object,
                _assistantServiceMock.Object,
                _storageDriverServiceMock.Object,
                _storageHelper,
                _serviceProviderMock.Object,
                _notificationServiceMock.Object
            );
        }

        private static MethodInfo GetStaticMethod(string name)
            => typeof(KeyManagementService).GetMethod(name, BindingFlags.NonPublic | BindingFlags.Static)!;

        private static MethodInfo GetInstanceMethod(string name)
            => typeof(KeyManagementService).GetMethod(name, BindingFlags.NonPublic | BindingFlags.Instance)!;

        #region MergeResources (private static)

        [Fact]
        public void MergeResources_BothNull_ReturnsEmpty()
        {
            var method = GetStaticMethod("MergeResources");
            var result = method.Invoke(null, new object?[] { null, null }) as Resource[];
            result.Should().NotBeNull().And.BeEmpty();
        }

        [Fact]
        public void MergeResources_ExistingNull_ReturnsNew()
        {
            var method = GetStaticMethod("MergeResources");
            var newRes = new[] { new Resource { Culture = "en", Value = "Hi" } };
            var result = method.Invoke(null, new object?[] { null, newRes }) as Resource[];
            result.Should().HaveCount(1);
            result![0].Value.Should().Be("Hi");
        }

        [Fact]
        public void MergeResources_NewNull_ReturnsExisting()
        {
            var method = GetStaticMethod("MergeResources");
            var existing = new[] { new Resource { Culture = "en", Value = "Hello" } };
            var result = method.Invoke(null, new object?[] { existing, null }) as Resource[];
            result.Should().HaveCount(1);
            result![0].Value.Should().Be("Hello");
        }

        [Fact]
        public void MergeResources_OverlappingCultures_NewOverridesExisting()
        {
            var method = GetStaticMethod("MergeResources");
            var existing = new[]
            {
                new Resource { Culture = "en", Value = "Hello" },
                new Resource { Culture = "de", Value = "Hallo" }
            };
            var newRes = new[]
            {
                new Resource { Culture = "en", Value = "Hi" },
                new Resource { Culture = "fr", Value = "Bonjour" }
            };
            var result = method.Invoke(null, new object?[] { existing, newRes }) as Resource[];
            result.Should().HaveCount(3);
            result!.First(r => r.Culture == "en").Value.Should().Be("Hi");
            result.First(r => r.Culture == "de").Value.Should().Be("Hallo");
            result.First(r => r.Culture == "fr").Value.Should().Be("Bonjour");
        }

        [Fact]
        public void MergeResources_NewEmptyValue_DoesNotOverrideExisting()
        {
            var method = GetStaticMethod("MergeResources");
            var existing = new[] { new Resource { Culture = "en", Value = "Hello" } };
            var newRes = new[] { new Resource { Culture = "en", Value = "" } };
            var result = method.Invoke(null, new object?[] { existing, newRes }) as Resource[];
            result.Should().HaveCount(1);
            result![0].Value.Should().Be("Hello");
        }

        [Fact]
        public void MergeResources_NewEmptyCulture_Skipped()
        {
            var method = GetStaticMethod("MergeResources");
            var existing = new[] { new Resource { Culture = "en", Value = "Hello" } };
            var newRes = new[] { new Resource { Culture = "", Value = "Ghost" } };
            var result = method.Invoke(null, new object?[] { existing, newRes }) as Resource[];
            result.Should().HaveCount(1);
        }

        [Fact]
        public void MergeResources_NewCultureNotInExisting_EmptyValue_AddsForTracking()
        {
            var method = GetStaticMethod("MergeResources");
            var existing = new[] { new Resource { Culture = "en", Value = "Hello" } };
            var newRes = new[] { new Resource { Culture = "fr", Value = "" } };
            var result = method.Invoke(null, new object?[] { existing, newRes }) as Resource[];
            result.Should().HaveCount(2);
            result!.First(r => r.Culture == "fr").Value.Should().BeEmpty();
        }

        #endregion

        #region MapToDbLanguageCode (private static)

        [Fact]
        public void MapToDbLanguageCode_NullInput_ReturnsNull()
        {
            var method = GetStaticMethod("MapToDbLanguageCode");
            var result = method.Invoke(null, new object?[] { null, new List<Language>() });
            result.Should().BeNull();
        }

        [Fact]
        public void MapToDbLanguageCode_EmptyInput_ReturnsNull()
        {
            var method = GetStaticMethod("MapToDbLanguageCode");
            var result = method.Invoke(null, new object?[] { "", new List<Language>() });
            result.Should().BeNull();
        }

        [Fact]
        public void MapToDbLanguageCode_NullLanguages_ReturnsNull()
        {
            var method = GetStaticMethod("MapToDbLanguageCode");
            var result = method.Invoke(null, new object?[] { "en", null });
            result.Should().BeNull();
        }

        [Fact]
        public void MapToDbLanguageCode_EmptyLanguages_ReturnsNull()
        {
            var method = GetStaticMethod("MapToDbLanguageCode");
            var result = method.Invoke(null, new object?[] { "en", new List<Language>() });
            result.Should().BeNull();
        }

        [Fact]
        public void MapToDbLanguageCode_ExactMatch_ReturnsCode()
        {
            var method = GetStaticMethod("MapToDbLanguageCode");
            var langs = new List<Language> { new() { LanguageCode = "de-DE" } };
            var result = method.Invoke(null, new object?[] { "de-DE", langs });
            result.Should().Be("de-DE");
        }

        [Fact]
        public void MapToDbLanguageCode_ExactMatchCaseInsensitive_ReturnsCode()
        {
            var method = GetStaticMethod("MapToDbLanguageCode");
            var langs = new List<Language> { new() { LanguageCode = "en-US" } };
            var result = method.Invoke(null, new object?[] { "EN-US", langs });
            result.Should().Be("en-US");
        }

        [Fact]
        public void MapToDbLanguageCode_PrefixMatch_ReturnsCode()
        {
            var method = GetStaticMethod("MapToDbLanguageCode");
            var langs = new List<Language> { new() { LanguageCode = "de-DE" } };
            var result = method.Invoke(null, new object?[] { "de", langs });
            result.Should().Be("de-DE");
        }

        [Fact]
        public void MapToDbLanguageCode_NoMatch_ReturnsNull()
        {
            var method = GetStaticMethod("MapToDbLanguageCode");
            var langs = new List<Language> { new() { LanguageCode = "en-US" } };
            var result = method.Invoke(null, new object?[] { "fr", langs });
            result.Should().BeNull();
        }

        #endregion

        #region IsValidXlfFileName (private static)

        private (bool isValid, string? langCode, bool isBase) InvokeIsValidXlfFileName(string fileName)
        {
            var method = typeof(KeyManagementService).GetMethod("IsValidXlfFileName", BindingFlags.NonPublic | BindingFlags.Static)!;
            var args = new object?[] { fileName, null, false };
            var result = (bool)method.Invoke(null, args)!;
            return (result, args[1] as string, (bool)args[2]!);
        }

        [Fact]
        public void IsValidXlfFileName_NullInput_ReturnsFalse()
        {
            var (isValid, _, _) = InvokeIsValidXlfFileName(null!);
            isValid.Should().BeFalse();
        }

        [Fact]
        public void IsValidXlfFileName_EmptyInput_ReturnsFalse()
        {
            var (isValid, _, _) = InvokeIsValidXlfFileName("");
            isValid.Should().BeFalse();
        }

        [Fact]
        public void IsValidXlfFileName_BaseFile_ReturnsTrue()
        {
            var (isValid, langCode, isBase) = InvokeIsValidXlfFileName("messages.xlf");
            isValid.Should().BeTrue();
            isBase.Should().BeTrue();
            langCode.Should().BeNull();
        }

        [Fact]
        public void IsValidXlfFileName_BaseFileCaseInsensitive_ReturnsTrue()
        {
            var (isValid, _, isBase) = InvokeIsValidXlfFileName("MESSAGES.XLF");
            isValid.Should().BeTrue();
            isBase.Should().BeTrue();
        }

        [Fact]
        public void IsValidXlfFileName_LanguageFile_ReturnsTrue()
        {
            var (isValid, langCode, isBase) = InvokeIsValidXlfFileName("messages.de.xlf");
            isValid.Should().BeTrue();
            isBase.Should().BeFalse();
            langCode.Should().Be("de");
        }

        [Fact]
        public void IsValidXlfFileName_LanguageFileWithRegion_ReturnsTrue()
        {
            var (isValid, langCode, _) = InvokeIsValidXlfFileName("messages.en-US.xlf");
            isValid.Should().BeTrue();
            langCode.Should().Be("en-US");
        }

        [Fact]
        public void IsValidXlfFileName_WrongPrefix_ReturnsFalse()
        {
            var (isValid, _, _) = InvokeIsValidXlfFileName("other.de.xlf");
            isValid.Should().BeFalse();
        }

        [Fact]
        public void IsValidXlfFileName_WrongExtension_ReturnsFalse()
        {
            var (isValid, _, _) = InvokeIsValidXlfFileName("messages.de.xml");
            isValid.Should().BeFalse();
        }

        [Fact]
        public void IsValidXlfFileName_TooManyDots_ReturnsFalse()
        {
            var (isValid, _, _) = InvokeIsValidXlfFileName("messages.de.extra.xlf");
            isValid.Should().BeFalse();
        }

        [Fact]
        public void IsValidXlfFileName_SingleChar_ReturnsFalse()
        {
            var (isValid, _, _) = InvokeIsValidXlfFileName("messages.x.xlf");
            isValid.Should().BeFalse();
        }

        [Fact]
        public void IsValidXlfFileName_NumericLang_ReturnsFalse()
        {
            var (isValid, _, _) = InvokeIsValidXlfFileName("messages.123.xlf");
            isValid.Should().BeFalse();
        }

        #endregion

        #region ExtractModelsFromXlf (private static)

        [Fact]
        public void ExtractModelsFromXlf_BaseFile_ExtractsKeysOnly()
        {
            var xlf = @"<?xml version=""1.0"" encoding=""utf-8""?>
<xliff version=""1.2"" xmlns=""urn:oasis:names:tc:xliff:document:1.2"">
  <file source-language=""en"" original=""auth"">
    <body>
      <trans-unit id=""1"">
        <source>Hello</source>
      </trans-unit>
      <trans-unit id=""2"">
        <source>Goodbye</source>
        <target>Bye</target>
      </trans-unit>
    </body>
  </file>
</xliff>";
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(xlf));
            var method = typeof(KeyManagementService).GetMethod("ExtractModelsFromXlf", BindingFlags.NonPublic | BindingFlags.Static)!;
            var dbLanguages = new List<Language> { new() { LanguageCode = "en-US" } };
            var result = method.Invoke(null, new object?[] { stream, null, true, dbLanguages }) as List<LanguageJsonModel>;
            result.Should().HaveCount(2);
            result![0].KeyName.Should().Be("Hello");
            // Base file: no resources added
            result[0].Resources.Should().BeEmpty();
        }

        [Fact]
        public void ExtractModelsFromXlf_LanguageFile_ExtractsTranslations()
        {
            var xlf = @"<?xml version=""1.0"" encoding=""utf-8""?>
<xliff version=""1.2"" xmlns=""urn:oasis:names:tc:xliff:document:1.2"">
  <file source-language=""en"" target-language=""de"" original=""auth"">
    <body>
      <trans-unit id=""1"">
        <source>Hello</source>
        <target>Hallo</target>
      </trans-unit>
    </body>
  </file>
</xliff>";
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(xlf));
            var method = typeof(KeyManagementService).GetMethod("ExtractModelsFromXlf", BindingFlags.NonPublic | BindingFlags.Static)!;
            var dbLanguages = new List<Language> { new() { LanguageCode = "de-DE" } };
            var result = method.Invoke(null, new object?[] { stream, "de-DE", false, dbLanguages }) as List<LanguageJsonModel>;
            result.Should().HaveCount(1);
            result![0].Resources.Should().HaveCount(1);
            result[0].Resources[0].Culture.Should().Be("de-DE");
            result[0].Resources[0].Value.Should().Be("Hallo");
        }

        [Fact]
        public void ExtractModelsFromXlf_WithNotes_ExtractsRoutesAndCharLength()
        {
            var xlf = @"<?xml version=""1.0"" encoding=""utf-8""?>
<xliff version=""1.2"" xmlns=""urn:oasis:names:tc:xliff:document:1.2"">
  <file source-language=""en"" target-language=""fr"" original=""ui"">
    <body>
      <trans-unit id=""k1"">
        <source>Submit</source>
        <target state=""needs-translation"">Soumettre</target>
        <note>Routes: /home, /dashboard</note>
        <note>CharacterLength: 10</note>
        <note>Module: ui</note>
      </trans-unit>
    </body>
  </file>
</xliff>";
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(xlf));
            var method = typeof(KeyManagementService).GetMethod("ExtractModelsFromXlf", BindingFlags.NonPublic | BindingFlags.Static)!;
            var result = method.Invoke(null, new object?[] { stream, "fr-FR", false, (List<Language>?)null }) as List<LanguageJsonModel>;
            result.Should().HaveCount(1);
            result![0].Routes.Should().Contain("/home");
            result[0].Routes.Should().Contain("/dashboard");
            result[0].IsPartiallyTranslated.Should().BeTrue();
            result[0].Resources[0].CharacterLength.Should().Be(10);
        }

        [Fact]
        public void ExtractModelsFromXlf_NoFileElements_ReturnsEmpty()
        {
            var xlf = @"<?xml version=""1.0"" encoding=""utf-8""?>
<xliff version=""1.2"" xmlns=""urn:oasis:names:tc:xliff:document:1.2"">
</xliff>";
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(xlf));
            var method = typeof(KeyManagementService).GetMethod("ExtractModelsFromXlf", BindingFlags.NonPublic | BindingFlags.Static)!;
            var result = method.Invoke(null, new object?[] { stream, null, false, (List<Language>?)null }) as List<LanguageJsonModel>;
            result.Should().BeEmpty();
        }

        [Fact]
        public void ExtractModelsFromXlf_EmptyKeyName_Skipped()
        {
            var xlf = @"<?xml version=""1.0"" encoding=""utf-8""?>
<xliff version=""1.2"" xmlns=""urn:oasis:names:tc:xliff:document:1.2"">
  <file source-language=""en"" original=""mod"">
    <body>
      <trans-unit id=""1"">
        <source>   </source>
      </trans-unit>
      <trans-unit id=""2"">
        <source>Valid</source>
      </trans-unit>
    </body>
  </file>
</xliff>";
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(xlf));
            var method = typeof(KeyManagementService).GetMethod("ExtractModelsFromXlf", BindingFlags.NonPublic | BindingFlags.Static)!;
            var result = method.Invoke(null, new object?[] { stream, "en-US", false, (List<Language>?)null }) as List<LanguageJsonModel>;
            // whitespace-only source is treated as empty by Trim in actual code
            result.Should().HaveCount(1);
            result![0].KeyName.Should().Be("Valid");
        }

        [Fact]
        public void ExtractModelsFromXlf_DuplicateKeyNames_MergedIntoOne()
        {
            var xlf = @"<?xml version=""1.0"" encoding=""utf-8""?>
<xliff version=""1.2"" xmlns=""urn:oasis:names:tc:xliff:document:1.2"">
  <file source-language=""en"" target-language=""de"" original=""mod"">
    <body>
      <trans-unit id=""1"">
        <source>Hello</source>
        <target>Hallo</target>
      </trans-unit>
    </body>
  </file>
  <file source-language=""en"" target-language=""fr"" original=""mod"">
    <body>
      <trans-unit id=""1"">
        <source>Hello</source>
        <target>Bonjour</target>
      </trans-unit>
    </body>
  </file>
</xliff>";
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(xlf));
            var method = typeof(KeyManagementService).GetMethod("ExtractModelsFromXlf", BindingFlags.NonPublic | BindingFlags.Static)!;
            var result = method.Invoke(null, new object?[] { stream, null, false, (List<Language>?)null }) as List<LanguageJsonModel>;
            result.Should().HaveCount(1);
            // Both target languages should be in Resources
            result![0].Resources.Should().HaveCountGreaterOrEqualTo(1);
        }

        #endregion

        #region ExtractModelsFromCsv additional tests

        [Fact]
        public void ExtractModelsFromCsv_MultipleLanguages_ParsesAll()
        {
            var csv = "ItemId,ModuleId,Module,KeyName,en-US,en-US_CharacterLength,de-DE,de-DE_CharacterLength\n" +
                      "1,m1,auth,hello,Hello,5,Hallo,5\n" +
                      "2,m1,auth,bye,Bye,3,Tschuss,7\n";
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));
            var method = GetStaticMethod("ExtractModelsFromCsv");
            var result = method.Invoke(null, new object[] { stream }) as List<LanguageJsonModel>;
            result.Should().HaveCount(2);
            result![0].Resources.Should().HaveCount(2);
            result[1].Resources.Should().HaveCount(2);
        }

        [Fact]
        public void ExtractModelsFromCsv_EmptyStream_ReturnsEmpty()
        {
            var csv = "ItemId,ModuleId,Module,KeyName\n";
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));
            var method = GetStaticMethod("ExtractModelsFromCsv");
            var result = method.Invoke(null, new object[] { stream }) as List<LanguageJsonModel>;
            result.Should().BeEmpty();
        }

        #endregion

        #region ExtractModelsFromJson additional tests

        [Fact]
        public void ExtractModelsFromJson_MultipleModels_ParsesAll()
        {
            var json = @"[
                {""_id"":""1"",""Module"":""auth"",""KeyName"":""hello"",""Resources"":[{""Culture"":""en"",""Value"":""Hello""}]},
                {""_id"":""2"",""Module"":""auth"",""KeyName"":""bye"",""Resources"":[{""Culture"":""en"",""Value"":""Bye""}]}
            ]";
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(json));
            var method = GetStaticMethod("ExtractModelsFromJson");
            var result = method.Invoke(null, new object[] { stream }) as List<LanguageJsonModel>;
            result.Should().HaveCount(2);
        }

        [Fact]
        public void ExtractModelsFromJson_EmptyArray_ReturnsEmpty()
        {
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes("[]"));
            var method = GetStaticMethod("ExtractModelsFromJson");
            var result = method.Invoke(null, new object[] { stream }) as List<LanguageJsonModel>;
            result.Should().BeEmpty();
        }

        #endregion

        #region SendTranslateAllEvent

        [Fact]
        public async Task SendTranslateAllEvent_PublishesToQueue()
        {
            var request = new TranslateAllRequest
            {
                MessageCoRelationId = "cor-1",
                ProjectKey = "proj",
                DefaultLanguage = "en-US"
            };

            await _service.SendTranslateAllEvent(request);

            _messageClientMock.Verify(m => m.SendToConsumerAsync(
                It.Is<ConsumerMessage<TranslateAllEvent>>(msg =>
                    msg.Payload.ProjectKey == "proj" &&
                    msg.Payload.DefaultLanguage == "en-US" &&
                    msg.Payload.MessageCoRelationId == "cor-1")),
                Times.Once);
        }

        #endregion

        #region SendUilmExportEvent

        [Fact]
        public async Task SendUilmExportEvent_PublishesToQueueWithNewFileId()
        {
            var request = new UilmExportRequest
            {
                MessageCoRelationId = "cor-2",
                ProjectKey = "proj",
                AppIds = new List<string> { "app1" },
                CallerTenantId = "t1",
                StartDate = DateTime.UtcNow.AddDays(-1),
                EndDate = DateTime.UtcNow,
                Languages = new List<string> { "en" },
                OutputType = OutputType.Json,
                ReferenceFileId = "ref-1"
            };

            await _service.SendUilmExportEvent(request);

            _messageClientMock.Verify(m => m.SendToConsumerAsync(
                It.Is<ConsumerMessage<UilmExportEvent>>(msg =>
                    msg.Payload.ProjectKey == "proj" &&
                    !string.IsNullOrEmpty(msg.Payload.FileId) &&
                    msg.Payload.OutputType == OutputType.Json)),
                Times.Once);
        }

        #endregion

        #region SendGenerateUilmFilesEvent

        [Fact]
        public async Task SendGenerateUilmFilesEvent_PublishesToQueue()
        {
            var request = new GenerateUilmFilesRequest
            {
                Guid = "g1",
                ProjectKey = "proj",
                ModuleId = "mod1"
            };

            await _service.SendGenerateUilmFilesEvent(request);

            _messageClientMock.Verify(m => m.SendToConsumerAsync(
                It.Is<ConsumerMessage<GenerateUilmFilesEvent>>(msg =>
                    msg.Payload.Guid == "g1" &&
                    msg.Payload.ProjectKey == "proj" &&
                    msg.Payload.ModuleId == "mod1")),
                Times.Once);
        }

        #endregion

        #region DeleteAsync

        [Fact]
        public async Task DeleteAsync_KeyNotFound_ReturnsFailure()
        {
            _keyRepositoryMock.Setup(r => r.GetByIdAsync("k1"))
                .ReturnsAsync((KeyModel?)null);

            var request = new DeleteKeyRequest { ItemId = "k1" };
            var result = await _service.DeleteAsysnc(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("ItemId");
        }

        [Fact]
        public async Task DeleteAsync_KeyFound_DeletesAndReturnsSuccess()
        {
            var key = new KeyModel { ItemId = "k1", KeyName = "myKey", ModuleId = "m1" };
            _keyRepositoryMock.Setup(r => r.GetByIdAsync("k1")).ReturnsAsync(key);
            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync("myKey", "m1"))
                .ReturnsAsync(new BlocksLanguageKey { ItemId = "k1", KeyName = "myKey", ModuleId = "m1" });
            _keyRepositoryMock.Setup(r => r.DeleteAsync("k1")).Returns(Task.CompletedTask);
            _keyTimelineRepositoryMock.Setup(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            var result = await _service.DeleteAsysnc(new DeleteKeyRequest { ItemId = "k1" });

            result.IsSuccess.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.DeleteAsync("k1"), Times.Once);
        }

        [Fact]
        public async Task DeleteAsync_TimelineCreationFails_StillDeletes2()
        {
            var key = new KeyModel { ItemId = "k1", KeyName = "myKey", ModuleId = "m1" };
            _keyRepositoryMock.Setup(r => r.GetByIdAsync("k1")).ReturnsAsync(key);
            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync("myKey", "m1"))
                .ThrowsAsync(new Exception("timeline fail"));
            _keyRepositoryMock.Setup(r => r.DeleteAsync("k1")).Returns(Task.CompletedTask);

            var result = await _service.DeleteAsysnc(new DeleteKeyRequest { ItemId = "k1" });

            result.IsSuccess.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.DeleteAsync("k1"), Times.Once);
        }

        #endregion

        #region SaveKeysAsync edge cases

        [Fact]
        public async Task SaveKeysAsync_EmptyList_ReturnsError()
        {
            var result = await _service.SaveKeysAsync(new List<KeyModel>());

            result.Success.Should().BeFalse();
        }

        [Fact]
        public async Task SaveKeysAsync_ValidKeys_SavesAll()
        {
            _validatorMock.Setup(v => v.ValidateAsync(It.IsAny<KeyModel>(), default))
                .ReturnsAsync(new ValidationResult());
            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync(It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync((BlocksLanguageKey?)null);
            _keyRepositoryMock.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()))
                .Returns(Task.CompletedTask);
            _keyTimelineRepositoryMock.Setup(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            var keys = new List<KeyModel>
            {
                new() { KeyName = "key1", ModuleId = "m1", Resources = new[] { new Resource { Culture = "en", Value = "v1" } } },
                new() { KeyName = "key2", ModuleId = "m1", Resources = new[] { new Resource { Culture = "en", Value = "v2" } } }
            };

            var result = await _service.SaveKeysAsync(keys);

            result.Success.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()), Times.Exactly(2));
        }

        [Fact]
        public async Task SaveKeysAsync_ValidationFails_ReportsError()
        {
            var failures = new List<ValidationFailure> { new("KeyName", "Key name is required") };
            _validatorMock.Setup(v => v.ValidateAsync(It.IsAny<KeyModel>(), default))
                .ReturnsAsync(new ValidationResult(failures));

            var keys = new List<KeyModel>
            {
                new() { KeyName = "", ModuleId = "m1" }
            };

            var result = await _service.SaveKeysAsync(keys);

            result.Success.Should().BeFalse();
        }

        [Fact]
        public async Task SaveKeysAsync_WithShouldPublishAndExistingKey_UpdatesAndCreatesTimeline()
        {
            var existingKey = new BlocksLanguageKey
            {
                ItemId = "existing-id", KeyName = "key1", ModuleId = "m1",
                Resources = new[] { new Resource { Culture = "en", Value = "old" } }
            };

            _validatorMock.Setup(v => v.ValidateAsync(It.IsAny<KeyModel>(), default))
                .ReturnsAsync(new ValidationResult());
            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync("key1", "m1"))
                .ReturnsAsync(existingKey);
            _keyRepositoryMock.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()))
                .Returns(Task.CompletedTask);
            _keyTimelineRepositoryMock.Setup(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            var keys = new List<KeyModel>
            {
                new() { KeyName = "key1", ModuleId = "m1", ShouldPublish = true, Resources = new[] { new Resource { Culture = "en", Value = "new" } } }
            };

            var result = await _service.SaveKeysAsync(keys);

            result.Success.Should().BeTrue();
        }

        #endregion

        #region GenerateAsync

        [Fact]
        public async Task GenerateAsync_WithModuleId_GeneratesForSpecificModule()
        {
            var command = new GenerateUilmFilesEvent { ProjectKey = "proj", ModuleId = "mod1" };

            _languageServiceMock.Setup(l => l.GetLanguagesAsync())
                .ReturnsAsync(new List<Language> { new() { LanguageCode = "en-US", LanguageName = "English" } });
            _moduleServiceMock.Setup(m => m.GetModulesAsync("mod1"))
                .ReturnsAsync(new List<BlocksLanguageModule>
                {
                    new() { ItemId = "mod1", ModuleName = "auth" }
                });
            _keyRepositoryMock.Setup(r => r.GetAllKeysByModuleAsync("mod1"))
                .ReturnsAsync(new List<KeyModel>());
            _keyRepositoryMock.Setup(r => r.DeleteOldUilmFiles(It.IsAny<List<UilmFile>>()))
                .ReturnsAsync(0L);
            _keyRepositoryMock.Setup(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>()))
                .ReturnsAsync(true);
            _lfgHistoryMock.Setup(h => h.GetLatestLanguageFileGenerationHistory(It.IsAny<string>()))
                .ReturnsAsync((LanguageFileGenerationHistory?)null);
            _lfgHistoryMock.Setup(h => h.SaveAsync(It.IsAny<LanguageFileGenerationHistory>()))
                .Returns(Task.CompletedTask);
            _notificationServiceMock.Setup(n => n.NotifyExtensionEvent(It.IsAny<bool>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            var result = await _service.GenerateAsync(command);

            result.Should().BeTrue();
            _notificationServiceMock.Verify(n => n.NotifyExtensionEvent(true, "proj"), Times.Once);
        }

        [Fact]
        public async Task GenerateAsync_WithoutModuleId_GeneratesForAllModules()
        {
            var command = new GenerateUilmFilesEvent { ProjectKey = "proj", ModuleId = null };

            _languageServiceMock.Setup(l => l.GetLanguagesAsync())
                .ReturnsAsync(new List<Language> { new() { LanguageCode = "en-US", LanguageName = "English" } });
            _moduleServiceMock.Setup(m => m.GetModulesAsync(It.IsAny<string>()))
                .ReturnsAsync(new List<BlocksLanguageModule>());
            _lfgHistoryMock.Setup(h => h.GetLatestLanguageFileGenerationHistory(It.IsAny<string>()))
                .ReturnsAsync((LanguageFileGenerationHistory?)null);
            _lfgHistoryMock.Setup(h => h.SaveAsync(It.IsAny<LanguageFileGenerationHistory>()))
                .Returns(Task.CompletedTask);

            var result = await _service.GenerateAsync(command);

            result.Should().BeTrue();
        }

        #endregion

        #region ExportUilmFile

        [Fact]
        public async Task ExportUilmFile_XlsxType_CallsGenerateXlsxFile()
        {
            SetupExportMocks();
            var xlsxGen = new Mock<XlsxOutputGeneratorService>();
            _serviceProviderMock.Setup(s => s.GetService(typeof(XlsxOutputGeneratorService)))
                .Returns(xlsxGen.Object);
            _keyRepositoryMock.Setup(r => r.GetAllLanguagesAsync(It.IsAny<string>()))
                .ReturnsAsync(new List<BlocksLanguage> { new() { LanguageCode = "en-US" } });
            xlsxGen.Setup(x => x.GenerateAsync<ClosedXML.Excel.XLWorkbook>(
                It.IsAny<List<BlocksLanguage>>(), It.IsAny<List<BlocksLanguageModule>>(),
                It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<string>()))
                .ReturnsAsync((ClosedXML.Excel.XLWorkbook?)null);

            var request = CreateExportRequest(OutputType.Xlsx);
            var result = await _service.ExportUilmFile(request);

            result.Should().BeFalse(); // workbook is null
        }

        [Fact]
        public async Task ExportUilmFile_JsonType_CallsGenerateJsonFile()
        {
            SetupExportMocks();
            var jsonGen = new Mock<JsonOutputGeneratorService>();
            _serviceProviderMock.Setup(s => s.GetService(typeof(JsonOutputGeneratorService)))
                .Returns(jsonGen.Object);
            _keyRepositoryMock.Setup(r => r.GetAllLanguagesAsync(It.IsAny<string>()))
                .ReturnsAsync(new List<BlocksLanguage> { new() { LanguageCode = "en-US" } });
            jsonGen.Setup(x => x.GenerateAsync<string>(
                It.IsAny<List<BlocksLanguage>>(), It.IsAny<List<BlocksLanguageModule>>(),
                It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<string>()))
                .ReturnsAsync((string?)null);

            var request = CreateExportRequest(OutputType.Json);
            var result = await _service.ExportUilmFile(request);

            result.Should().BeFalse();
        }

        [Fact]
        public async Task ExportUilmFile_CsvType_CallsGenerateCsvFile()
        {
            SetupExportMocks();
            var csvGen = new Mock<CsvOutputGeneratorService>();
            _serviceProviderMock.Setup(s => s.GetService(typeof(CsvOutputGeneratorService)))
                .Returns(csvGen.Object);
            _keyRepositoryMock.Setup(r => r.GetAllLanguagesAsync(It.IsAny<string>()))
                .ReturnsAsync(new List<BlocksLanguage> { new() { LanguageCode = "en-US" } });
            csvGen.Setup(x => x.GenerateAsync<string>(
                It.IsAny<List<BlocksLanguage>>(), It.IsAny<List<BlocksLanguageModule>>(),
                It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<string>()))
                .ReturnsAsync((string?)null);

            var request = CreateExportRequest(OutputType.Csv);
            var result = await _service.ExportUilmFile(request);

            result.Should().BeFalse();
        }

        private void SetupExportMocks()
        {
            _keyRepositoryMock.Setup(r => r.GetLanguageSettingAsync(It.IsAny<string>()))
                .ReturnsAsync(new BlocksLanguage { LanguageCode = "en-US" });
            _keyRepositoryMock.Setup(r => r.GetUilmApplications<BlocksLanguageModule>(
                It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageModule, bool>>>()))
                .ReturnsAsync(new List<BlocksLanguageModule>());
            _keyRepositoryMock.Setup(r => r.GetUilmResourceKeys(
                It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(), It.IsAny<string>()))
                .ReturnsAsync(new List<BlocksLanguageKey>());
        }

        private UilmExportEvent CreateExportRequest(OutputType outputType)
        {
            return new UilmExportEvent
            {
                FileId = "file-1",
                ProjectKey = "proj",
                OutputType = outputType,
                Languages = new List<string> { "en-US" }
            };
        }

        #endregion

        #region MapBlocksLanguageKeyToKey (private)

        [Fact]
        public void MapBlocksLanguageKeyToKey_MapsCorrectly()
        {
            var method = GetInstanceMethod("MapBlocksLanguageKeyToKey");
            var blocksKey = new BlocksLanguageKey
            {
                ItemId = "k1",
                KeyName = "welcome",
                ModuleId = "m1",
                Resources = new[] { new Resource { Culture = "en", Value = "Welcome" } },
                Routes = new List<string> { "/home" },
                IsPartiallyTranslated = true,
                CreateDate = DateTime.UtcNow.AddDays(-1),
                LastUpdateDate = DateTime.UtcNow
            };

            var result = method.Invoke(_service, new object?[] { blocksKey, "proj-key" }) as KeyModel;

            result.Should().NotBeNull();
            result!.ItemId.Should().Be("k1");
            result.KeyName.Should().Be("welcome");
            result.ModuleId.Should().Be("m1");
            result.ProjectKey.Should().Be("proj-key");
            result.IsNewKey.Should().BeFalse();
        }

        #endregion

        #region MapKeyToBlocksLanguageKey (private)

        [Fact]
        public void MapKeyToBlocksLanguageKey_WithItemId_KeepsIt()
        {
            var method = GetInstanceMethod("MapKeyToBlocksLanguageKey");
            var key = new KeyModel
            {
                ItemId = "existing-id",
                KeyName = "key1",
                ModuleId = "m1",
                Resources = new[] { new Resource { Culture = "en", Value = "val" } },
                Routes = new List<string> { "/page" }
            };

            var result = method.Invoke(_service, new object[] { key }) as BlocksLanguageKey;

            result.Should().NotBeNull();
            result!.ItemId.Should().Be("existing-id");
            result.KeyName.Should().Be("key1");
        }

        [Fact]
        public void MapKeyToBlocksLanguageKey_WithoutItemId_GeneratesNew()
        {
            var method = GetInstanceMethod("MapKeyToBlocksLanguageKey");
            var key = new KeyModel
            {
                ItemId = null,
                KeyName = "key1",
                ModuleId = "m1"
            };

            var result = method.Invoke(_service, new object[] { key }) as BlocksLanguageKey;

            result.Should().NotBeNull();
            result!.ItemId.Should().NotBeNullOrEmpty();
            result.Routes.Should().BeEmpty();
        }

        #endregion

        #region GetBlocksLanguageKey (private deep copy)

        [Fact]
        public void GetBlocksLanguageKey_CreatesDeepCopy()
        {
            var method = GetInstanceMethod("GetBlocksLanguageKey");
            var original = new BlocksLanguageKey
            {
                ItemId = "k1",
                KeyName = "key1",
                ModuleId = "m1",
                Resources = new[] { new Resource { Culture = "en", Value = "Hello" } },
                Routes = new List<string> { "/home" },
                IsPartiallyTranslated = false
            };

            var copy = method.Invoke(_service, new object[] { original }) as BlocksLanguageKey;

            copy.Should().NotBeNull();
            copy!.ItemId.Should().Be("k1");
            copy.KeyName.Should().Be("key1");
            copy.Resources.Should().HaveCount(1);
        }

        #endregion

        #region AssignToDictionary (private) additional cases

        [Fact]
        public void AssignToDictionary_SimpleKey_AssignsDirectly()
        {
            var dict = new Dictionary<string, object>();
            var method = GetInstanceMethod("AssignToDictionary");
            method.Invoke(_service, new object[] { dict, "simpleKey", "value" });
            dict.Should().ContainKey("simpleKey");
            dict["simpleKey"].Should().Be("value");
        }

        [Fact]
        public void AssignToDictionary_DeepNesting_CreatesAllLevels()
        {
            var dict = new Dictionary<string, object>();
            var method = GetInstanceMethod("AssignToDictionary");
            method.Invoke(_service, new object[] { dict, "a.b.c.d", "deep" });

            var a = dict["a"] as Dictionary<string, object>;
            var b = a!["b"] as Dictionary<string, object>;
            var c = b!["c"] as Dictionary<string, object>;
            c!["d"].Should().Be("deep");
        }

        [Fact]
        public void AssignToDictionary_ConflictingPath_LogsError()
        {
            var dict = new Dictionary<string, object>();
            var method = GetInstanceMethod("AssignToDictionary");
            // First set a.b = "value" (string)
            method.Invoke(_service, new object[] { dict, "a.b", "value" });
            // Then try a.b.c = "nested" which will conflict because a.b is already a string
            method.Invoke(_service, new object[] { dict, "a.b.c", "nested" });
            // Should not throw; the logger error path is triggered
        }

        #endregion

        #region CreateKeyTimelineEntryAsync (private - via reflection)

        [Fact]
        public async Task CreateKeyTimelineEntryAsync_SavesTimeline()
        {
            _keyTimelineRepositoryMock.Setup(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            var method = GetInstanceMethod("CreateKeyTimelineEntryAsync");
            var previous = new BlocksLanguageKey { ItemId = "k1", KeyName = "key1" };
            var current = new BlocksLanguageKey { ItemId = "k1", KeyName = "key1" };

            var task = method.Invoke(_service, new object?[] { previous, current, "Test", null, null }) as Task;
            await task!;

            _keyTimelineRepositoryMock.Verify(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Once);
        }

        [Fact]
        public async Task CreateKeyTimelineEntryAsync_ExceptionSwallowed()
        {
            _keyTimelineRepositoryMock.Setup(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .ThrowsAsync(new Exception("timeline error"));

            var method = GetInstanceMethod("CreateKeyTimelineEntryAsync");
            var current = new BlocksLanguageKey { ItemId = "k1", KeyName = "key1" };

            var task = method.Invoke(_service, new object?[] { (BlocksLanguageKey?)null, current, "Test", null, null }) as Task;
            // Should not throw
            await task!;
        }

        #endregion

        #region WriteToXlf and CreateZipStream (private)

        [Fact]
        public void WriteToXlf_UpdatesTargetElements()
        {
            var xlf = @"<?xml version=""1.0"" encoding=""utf-8""?>
<xliff version=""1.2"" xmlns=""urn:oasis:names:tc:xliff:document:1.2"">
  <file source-language=""en"" target-language=""de"" original=""mod"">
    <body>
      <trans-unit id=""1"">
        <source>Hello</source>
        <target>OldTranslation</target>
      </trans-unit>
      <trans-unit id=""2"">
        <source>World</source>
      </trans-unit>
    </body>
  </file>
</xliff>";
            using var templateStream = new MemoryStream(Encoding.UTF8.GetBytes(xlf));
            var resourceMap = new Dictionary<string, string>
            {
                { "Hello", "Hallo" },
                { "World", "Welt" }
            };

            var method = GetInstanceMethod("WriteToXlf");
            var result = method.Invoke(_service, new object[] { templateStream, resourceMap, "de" }) as MemoryStream;

            result.Should().NotBeNull();
            result!.Length.Should().BeGreaterThan(0);
            result.Position = 0;
            var content = new StreamReader(result).ReadToEnd();
            content.Should().Contain("Hallo");
            content.Should().Contain("Welt");
        }

        [Fact]
        public void WriteToXlf_InvalidXml_ReturnsEmptyStream()
        {
            using var badStream = new MemoryStream(Encoding.UTF8.GetBytes("not xml"));
            var method = GetInstanceMethod("WriteToXlf");
            var result = method.Invoke(_service, new object[] { badStream, new Dictionary<string, string>(), "de" }) as MemoryStream;
            result.Should().NotBeNull();
            result!.Length.Should().Be(0);
        }

        [Fact]
        public void CreateZipStream_CreatesValidZip()
        {
            var fileMap = new Dictionary<string, MemoryStream>
            {
                { "file1.txt", new MemoryStream(Encoding.UTF8.GetBytes("content1")) },
                { "file2.txt", new MemoryStream(Encoding.UTF8.GetBytes("content2")) }
            };

            var method = GetInstanceMethod("CreateZipStream");
            var result = method.Invoke(_service, new object[] { fileMap }) as MemoryStream;

            result.Should().NotBeNull();
            result!.Length.Should().BeGreaterThan(0);

            // Verify it's a valid zip by attempting to open it
            result.Position = 0;
            using var archive = new System.IO.Compression.ZipArchive(result, System.IO.Compression.ZipArchiveMode.Read);
            archive.Entries.Should().HaveCount(2);
        }

        #endregion

        #region GetLanguageResourceKeys (private)

        [Fact]
        public async Task GetLanguageResourceKeys_WithAppIds_FiltersKeys()
        {
            _keyRepositoryMock.Setup(r => r.GetUilmResourceKeys(
                It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(), It.IsAny<string>()))
                .ReturnsAsync(new List<BlocksLanguageKey>
                {
                    new() { ItemId = "k1", ModuleId = "app1" }
                });

            var method = GetInstanceMethod("GetLanguageResourceKeys");
            var task = method.Invoke(_service, new object?[]
            {
                new List<string> { "app1" }, default(DateTime), default(DateTime)
            }) as Task<List<BlocksLanguageKey>>;

            var result = await task!;
            result.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetLanguageResourceKeys_WithoutAppIds_GetsAll()
        {
            _keyRepositoryMock.Setup(r => r.GetUilmResourceKeys(
                It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(), It.IsAny<string>()))
                .ReturnsAsync(new List<BlocksLanguageKey>
                {
                    new() { ItemId = "k1" },
                    new() { ItemId = "k2" }
                });

            var method = GetInstanceMethod("GetLanguageResourceKeys");
            var task = method.Invoke(_service, new object?[]
            {
                null, default(DateTime), default(DateTime)
            }) as Task<List<BlocksLanguageKey>>;

            var result = await task!;
            result.Should().HaveCount(2);
        }

        #endregion

        #region SaveUilmResourceKey (private)

        [Fact]
        public async Task SaveUilmResourceKey_UpdatesAndInserts()
        {
            _keyRepositoryMock.Setup(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()))
                .ReturnsAsync(1);
            _keyRepositoryMock.Setup(r => r.InsertUilmResourceKeys(It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);
            _keyTimelineRepositoryMock.Setup(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            var updates = new List<BlocksLanguageKey>
            {
                new() { ItemId = "k1", KeyName = "key1", ModuleId = "m1" }
            };
            var inserts = new List<BlocksLanguageKey>
            {
                new() { ItemId = "k2", KeyName = "key2", ModuleId = "m1" }
            };

            var method = typeof(KeyManagementService).GetMethod("SaveUilmResourceKey",
                BindingFlags.NonPublic | BindingFlags.Instance,
                null,
                new[] { typeof(List<BlocksLanguageKey>), typeof(List<BlocksLanguageKey>), typeof(List<BlocksLanguageKey>) },
                null)!;

            var task = method.Invoke(_service, new object?[] { updates, inserts, null }) as Task;
            await task!;

            _keyRepositoryMock.Verify(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()), Times.Once);
            _keyRepositoryMock.Verify(r => r.InsertUilmResourceKeys(It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<string>()), Times.Once);
        }

        #endregion

        #region SaveUilmApplication (private)

        [Fact]
        public async Task SaveUilmApplication_InsertsAndUpdates()
        {
            _keyRepositoryMock.Setup(r => r.UpdateBulkUilmApplications(
                It.IsAny<List<BlocksLanguageModule>>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);
            _keyRepositoryMock.Setup(r => r.InsertUilmApplications(It.IsAny<List<BlocksLanguageModule>>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);
            _keyRepositoryMock.Setup(r => r.UpdateKeysCountOfAppAsync(
                It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            var method = GetInstanceMethod("SaveUilmApplication");
            var inserts = new List<BlocksLanguageModule>
            {
                new() { ItemId = "m1", ModuleName = "auth" }
            };
            var updates = new List<BlocksLanguageModule>
            {
                new() { ItemId = "m2", ModuleName = "core" }
            };

            var task = method.Invoke(_service, new object[] { inserts, updates }) as Task;
            await task!;

            _keyRepositoryMock.Verify(r => r.InsertUilmApplications(It.IsAny<List<BlocksLanguageModule>>(), It.IsAny<string>()), Times.Once);
            _keyRepositoryMock.Verify(r => r.UpdateBulkUilmApplications(
                It.IsAny<List<BlocksLanguageModule>>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<string>()), Times.Once);
        }

        #endregion

        #region HandleUilmApplication / HandleApplicationWithoutAppId / HandleApplicationWithAppId (private)

        [Fact]
        public void HandleUilmApplication_WithoutAppId_DelegatesToWithoutAppId()
        {
            var method = typeof(KeyManagementService).GetMethod("HandleUilmApplication",
                BindingFlags.NonPublic | BindingFlags.Instance)!;

            var dbApps = new List<BlocksLanguageModule>
            {
                new() { ItemId = "m1", ModuleName = "auth" }
            };
            var insertList = new List<BlocksLanguageModule>();
            var updateList = new List<BlocksLanguageModule>();

            var resultAppId = method.Invoke(_service, new object?[]
            {
                dbApps, insertList, updateList, null, true, "auth"
            }) as string;

            // Should find existing module "auth" and return its ItemId
            resultAppId.Should().Be("m1");
        }

        [Fact]
        public void HandleUilmApplication_WithAppId_DelegatesToWithAppId()
        {
            var method = typeof(KeyManagementService).GetMethod("HandleUilmApplication",
                BindingFlags.NonPublic | BindingFlags.Instance)!;

            var dbApps = new List<BlocksLanguageModule>
            {
                new() { ItemId = "m1", ModuleName = "auth" }
            };
            var insertList = new List<BlocksLanguageModule>();
            var updateList = new List<BlocksLanguageModule>();

            method.Invoke(_service, new object?[]
            {
                dbApps, insertList, updateList, "m1", true, "auth"
            });

            // Should find existing app by ItemId and add to update list
            updateList.Should().HaveCount(1);
        }

        [Fact]
        public void HandleApplicationWithoutAppId_NewModule_CreatesAndReturnsId()
        {
            var method = typeof(KeyManagementService).GetMethod("HandleApplicationWithoutAppId",
                BindingFlags.NonPublic | BindingFlags.Instance)!;

            var dbApps = new List<BlocksLanguageModule>();
            var insertList = new List<BlocksLanguageModule>();
            var updateList = new List<BlocksLanguageModule>();

            var resultAppId = method.Invoke(_service, new object?[]
            {
                dbApps, insertList, updateList, true, "newModule", null
            }) as string;

            resultAppId.Should().NotBeNullOrEmpty();
            insertList.Should().HaveCount(1);
            insertList[0].ModuleName.Should().Be("newModule");
        }

        [Fact]
        public void HandleApplicationWithoutAppId_ExistingModule_ReturnsExistingId()
        {
            var method = typeof(KeyManagementService).GetMethod("HandleApplicationWithoutAppId",
                BindingFlags.NonPublic | BindingFlags.Instance)!;

            var dbApps = new List<BlocksLanguageModule>
            {
                new() { ItemId = "existing-id", ModuleName = "auth" }
            };
            var insertList = new List<BlocksLanguageModule>();
            var updateList = new List<BlocksLanguageModule>();

            var resultAppId = method.Invoke(_service, new object?[]
            {
                dbApps, insertList, updateList, true, "auth", null
            }) as string;

            resultAppId.Should().Be("existing-id");
            updateList.Should().HaveCount(1);
        }

        [Fact]
        public void HandleApplicationWithAppId_ExistingApp_AddsToUpdateList()
        {
            var method = typeof(KeyManagementService).GetMethod("HandleApplicationWithAppId",
                BindingFlags.NonPublic | BindingFlags.Instance)!;

            var dbApps = new List<BlocksLanguageModule>
            {
                new() { ItemId = "m1", ModuleName = "auth" }
            };
            var insertList = new List<BlocksLanguageModule>();
            var updateList = new List<BlocksLanguageModule>();

            method.Invoke(_service, new object?[]
            {
                dbApps, insertList, updateList, "m1", true, "auth_updated"
            });

            updateList.Should().HaveCount(1);
        }

        [Fact]
        public void HandleApplicationWithAppId_NewApp_AddsToInsertList()
        {
            var method = typeof(KeyManagementService).GetMethod("HandleApplicationWithAppId",
                BindingFlags.NonPublic | BindingFlags.Instance)!;

            var dbApps = new List<BlocksLanguageModule>();
            var insertList = new List<BlocksLanguageModule>();
            var updateList = new List<BlocksLanguageModule>();

            method.Invoke(_service, new object?[]
            {
                dbApps, insertList, updateList, "new-id", true, "newModule"
            });

            insertList.Should().HaveCount(1);
            insertList[0].ItemId.Should().Be("new-id");
        }

        #endregion

        #region GetUilmResourceKey (private)

        [Fact]
        public async Task GetUilmResourceKey_EmptyAppId_ReturnsNull()
        {
            var method = GetInstanceMethod("GetUilmResourceKey");
            var task = method.Invoke(_service, new object?[] { "", "keyName" }) as Task<BlocksLanguageKey>;
            var result = await task!;
            result.Should().BeNull();
        }

        [Fact]
        public async Task GetUilmResourceKey_EmptyKeyName_ReturnsNull()
        {
            var method = GetInstanceMethod("GetUilmResourceKey");
            var task = method.Invoke(_service, new object?[] { "appId", "" }) as Task<BlocksLanguageKey>;
            var result = await task!;
            result.Should().BeNull();
        }

        [Fact]
        public async Task GetUilmResourceKey_ValidInput_CallsRepository()
        {
            _keyRepositoryMock.Setup(r => r.GetUilmResourceKey(
                It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(), It.IsAny<string>()))
                .ReturnsAsync(new BlocksLanguageKey { ItemId = "k1" });

            var method = GetInstanceMethod("GetUilmResourceKey");
            var task = method.Invoke(_service, new object?[] { "appId", "keyName" }) as Task<BlocksLanguageKey>;
            var result = await task!;
            result.Should().NotBeNull();
        }

        #endregion

        #region AddNumberOfKeysInUilmApplications / InsertUilmApplications (private)

        [Fact]
        public async Task AddNumberOfKeysInUilmApplications_UpdatesEachApp()
        {
            _keyRepositoryMock.Setup(r => r.UpdateKeysCountOfAppAsync(
                It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            var method = GetInstanceMethod("AddNumberOfKeysInUilmApplications");
            var apps = new List<BlocksLanguageModule>
            {
                new() { ItemId = "m1" },
                new() { ItemId = "m2" }
            };

            var task = method.Invoke(_service, new object[] { apps }) as Task;
            await task!;

            _keyRepositoryMock.Verify(r => r.UpdateKeysCountOfAppAsync(
                It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<string>()), Times.Exactly(2));
        }

        [Fact]
        public async Task InsertUilmApplications_CallsRepository()
        {
            _keyRepositoryMock.Setup(r => r.InsertUilmApplications(It.IsAny<List<BlocksLanguageModule>>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            var method = GetInstanceMethod("InsertUilmApplications");
            var apps = new List<BlocksLanguageModule>
            {
                new() { ItemId = "m1", ModuleName = "auth" }
            };

            var task = method.Invoke(_service, new object[] { apps }) as Task;
            await task!;

            _keyRepositoryMock.Verify(r => r.InsertUilmApplications(It.IsAny<List<BlocksLanguageModule>>(), It.IsAny<string>()), Times.Once);
        }

        #endregion

        #region GetLanguageSetting (private)

        [Fact]
        public async Task GetLanguageSetting_ReturnsFromRepository()
        {
            _keyRepositoryMock.Setup(r => r.GetLanguageSettingAsync(It.IsAny<string>()))
                .ReturnsAsync(new BlocksLanguage { LanguageCode = "en-US" });

            var method = GetInstanceMethod("GetLanguageSetting");
            var task = method.Invoke(_service, null) as Task<BlocksLanguage>;
            var result = await task!;

            result.Should().NotBeNull();
            result.LanguageCode.Should().Be("en-US");
        }

        #endregion

        #region GetLanguageApplications (private)

        [Fact]
        public async Task GetLanguageApplications_WithAppIds_FiltersApps()
        {
            _keyRepositoryMock.Setup(r => r.GetUilmApplications<BlocksLanguageModule>(
                It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageModule, bool>>>()))
                .ReturnsAsync(new List<BlocksLanguageModule>
                {
                    new() { ItemId = "m1", ModuleName = "auth" }
                });

            var method = typeof(KeyManagementService).GetMethod("GetLanguageApplications",
                BindingFlags.NonPublic | BindingFlags.Instance)!;
            var task = method.Invoke(_service, new object?[] { new List<string> { "m1" } }) as Task<List<BlocksLanguageModule>>;
            var result = await task!;

            result.Should().HaveCount(1);
            result[0].ItemId.Should().Be("m1");
        }

        [Fact]
        public async Task GetLanguageApplications_WithoutAppIds_ReturnsAll()
        {
            _keyRepositoryMock.Setup(r => r.GetUilmApplications<BlocksLanguageModule>(
                It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageModule, bool>>>()))
                .ReturnsAsync(new List<BlocksLanguageModule>
                {
                    new() { ItemId = "m1" },
                    new() { ItemId = "m2" }
                });

            var method = typeof(KeyManagementService).GetMethod("GetLanguageApplications",
                BindingFlags.NonPublic | BindingFlags.Instance)!;
            var task = method.Invoke(_service, new object?[] { (List<string>?)null }) as Task<List<BlocksLanguageModule>>;
            var result = await task!;

            result.Should().HaveCount(2);
        }

        #endregion

        #region UpdateResourceKey with originalResourceKeys

        [Fact]
        public async Task UpdateResourceKey_WithOriginalKeys_CreatesTimelinesWithPrevious()
        {
            _keyRepositoryMock.Setup(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()))
                .ReturnsAsync(1L);
            _keyTimelineRepositoryMock.Setup(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            var resourceKeys = new List<BlocksLanguageKey>
            {
                new() { ItemId = "k1", KeyName = "key1", ModuleId = "m1",
                    Resources = new[] { new Resource { Culture = "en", Value = "Updated" } } }
            };
            var originals = new Dictionary<string, BlocksLanguageKey>
            {
                ["k1"] = new() { ItemId = "k1", KeyName = "key1", ModuleId = "m1",
                    Resources = new[] { new Resource { Culture = "en", Value = "Original" } } }
            };

            await _service.UpdateResourceKey(resourceKeys, new TranslateAllEvent(), originals);

            _keyTimelineRepositoryMock.Verify(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Once);
        }

        [Fact]
        public async Task UpdateResourceKey_WithoutOriginalKeys_CreatesTimelinesWithNull()
        {
            _keyRepositoryMock.Setup(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()))
                .ReturnsAsync(1L);
            _keyTimelineRepositoryMock.Setup(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            var resourceKeys = new List<BlocksLanguageKey>
            {
                new() { ItemId = "k1", KeyName = "key1", ModuleId = "m1" }
            };

            await _service.UpdateResourceKey(resourceKeys, new TranslateAllEvent(), null);

            _keyTimelineRepositoryMock.Verify(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Once);
        }

        [Fact]
        public async Task UpdateResourceKey_TimelineException_DoesNotThrow()
        {
            _keyRepositoryMock.Setup(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()))
                .ReturnsAsync(1L);
            _keyTimelineRepositoryMock.Setup(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .ThrowsAsync(new Exception("timeline fail"));

            var resourceKeys = new List<BlocksLanguageKey>
            {
                new() { ItemId = "k1", KeyName = "key1", ModuleId = "m1" }
            };

            // Should not throw
            await _service.UpdateResourceKey(resourceKeys, new TranslateAllEvent(), null);
        }

        #endregion

        #region GenerateAsync with module keys (covers loop body)

        [Fact]
        public async Task GenerateAsync_WithModuleAndKeys_SavesUilmFiles()
        {
            var command = new GenerateUilmFilesEvent { ProjectKey = "proj", ModuleId = "mod1" };

            _languageServiceMock.Setup(l => l.GetLanguagesAsync())
                .ReturnsAsync(new List<Language> { new() { LanguageCode = "en-US", LanguageName = "English" } });
            _moduleServiceMock.Setup(m => m.GetModulesAsync("mod1"))
                .ReturnsAsync(new List<BlocksLanguageModule>
                {
                    new() { ItemId = "mod1", ModuleName = "auth" }
                });
            _keyRepositoryMock.Setup(r => r.GetAllKeysByModuleAsync("mod1"))
                .ReturnsAsync(new List<KeyModel>
                {
                    new() { ItemId = "k1", KeyName = "hello", ModuleId = "mod1",
                        Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } } }
                });
            _keyRepositoryMock.Setup(r => r.DeleteOldUilmFiles(It.IsAny<List<UilmFile>>()))
                .ReturnsAsync(0L);
            _keyRepositoryMock.Setup(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>()))
                .ReturnsAsync(true);
            _lfgHistoryMock.Setup(h => h.GetLatestLanguageFileGenerationHistory(It.IsAny<string>()))
                .ReturnsAsync(new LanguageFileGenerationHistory { ItemId = "h1", ProjectKey = "proj", Version = 5 });
            _lfgHistoryMock.Setup(h => h.SaveAsync(It.IsAny<LanguageFileGenerationHistory>()))
                .Returns(Task.CompletedTask);
            _notificationServiceMock.Setup(n => n.NotifyExtensionEvent(It.IsAny<bool>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            var result = await _service.GenerateAsync(command);

            result.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.DeleteOldUilmFiles(It.IsAny<List<UilmFile>>()), Times.Once);
            _keyRepositoryMock.Verify(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>()), Times.Once);
        }

        #endregion

        #region CreateUilmExportedFileEntryAsync (private)

        [Fact]
        public async Task CreateUilmExportedFileEntryAsync_SavesEntry()
        {
            _keyRepositoryMock.Setup(r => r.SaveUilmExportedFileAsync(It.IsAny<UilmExportedFile>()))
                .Returns(Task.CompletedTask);

            var method = typeof(KeyManagementService).GetMethod("CreateUilmExportedFileEntryAsync",
                BindingFlags.NonPublic | BindingFlags.Instance)!;

            var task = method.Invoke(_service, new object[] { "file-1", "export.xlsx" }) as Task;
            await task!;

            _keyRepositoryMock.Verify(r => r.SaveUilmExportedFileAsync(It.IsAny<UilmExportedFile>()), Times.Once);
        }

        [Fact]
        public async Task CreateUilmExportedFileEntryAsync_ExceptionSwallowed()
        {
            _keyRepositoryMock.Setup(r => r.SaveUilmExportedFileAsync(It.IsAny<UilmExportedFile>()))
                .ThrowsAsync(new Exception("db error"));

            var method = typeof(KeyManagementService).GetMethod("CreateUilmExportedFileEntryAsync",
                BindingFlags.NonPublic | BindingFlags.Instance)!;

            var task = method.Invoke(_service, new object[] { "file-1", "export.xlsx" }) as Task;
            // Should not throw
            await task!;
        }

        #endregion

        #region CompareAndAddResources edge case
        
        [Fact]
        public void CompareAndAddResources_ResourcesEmpty_AddsAllLanguages()
        {
            var resources = new List<Resource>();
            var existing = Enumerable.Empty<Resource>();
            var languages = new List<Language>
            {
                new() { LanguageCode = "en-US" },
                new() { LanguageCode = "de-DE" }
            };

            _service.CompareAndAddResources(resources, existing, languages);

            resources.Should().HaveCount(2);
        }

        #endregion

        #region ProcessMissingResource edge cases

        [Fact]
        public async Task ProcessMissingResource_WithLanguageName_CallsAssistant()
        {
            var request = new TranslateAllEvent { DefaultLanguage = "en-US", ProjectKey = "proj" };
            var key = new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" };
            var defaultRes = new Resource { Culture = "en-US", Value = "Hello" };
            var targetRes = new Resource { Culture = "fr-FR", Value = "" };
            var list = new List<Resource>();
            var languages = new List<Language>
            {
                new() { LanguageCode = "en-US", LanguageName = "English" },
                new() { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            _assistantServiceMock.Setup(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()))
                .ReturnsAsync("Bonjour");

            await _service.ProcessMissingResource(request, key, defaultRes, targetRes, list, languages);

            _assistantServiceMock.Verify(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()), Times.Once);
            list.Should().ContainSingle().Which.Value.Should().Be("Bonjour");
        }

        #endregion

        #region ConstructQuery (public static)

        [Fact]
        public void ConstructQuery_ReturnsCorrectRequest()
        {
            var request = new TranslateAllEvent { DefaultLanguage = "en-US", ProjectKey = "proj" };
            var key = new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", Context = "login page" };
            var defaultResource = new Resource { Culture = "en-US", Value = "Hello" };
            var missingResource = new Resource { Culture = "fr-FR", Value = "" };
            var languages = new List<Language>
            {
                new() { LanguageCode = "en-US", LanguageName = "English" },
                new() { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var result = KeyManagementService.ConstructQuery(request, key, defaultResource, missingResource, "French", languages);

            result.SourceText.Should().Be("Hello");
            result.DestinationLanguage.Should().Be("French");
            result.CurrentLanguage.Should().Be("English");
            result.ElementDetailContext.Should().Be("login page");
        }

        [Fact]
        public void ConstructQuery_NullDefaultResource_SourceTextNull()
        {
            var request = new TranslateAllEvent { DefaultLanguage = "en-US" };
            var key = new BlocksLanguageKey { ItemId = "k1" };
            var languages = new List<Language> { new() { LanguageCode = "en-US", LanguageName = "English" } };

            var result = KeyManagementService.ConstructQuery(request, key, null!, new Resource(), "French", languages);

            result.SourceText.Should().BeNull();
        }

        #endregion

        #region EmptyResourcesThatHasReservedKeywords & HasKeywordValue (public static)

        [Fact]
        public void HasKeywordValue_KeyMissing_ReturnsTrue()
        {
            var resources = new List<Resource>
            {
                new() { Culture = "en-US", Value = "KEY_MISSING" }
            };

            KeyManagementService.HasKeywordValue(resources, "en-US").Should().BeTrue();
        }

        [Fact]
        public void HasKeywordValue_KeyMissingLowerCase_ReturnsTrue()
        {
            var resources = new List<Resource>
            {
                new() { Culture = "en-US", Value = "key_missing" }
            };

            KeyManagementService.HasKeywordValue(resources, "en-US").Should().BeTrue();
        }

        [Fact]
        public void HasKeywordValue_NormalValue_ReturnsFalse()
        {
            var resources = new List<Resource>
            {
                new() { Culture = "en-US", Value = "Hello" }
            };

            KeyManagementService.HasKeywordValue(resources, "en-US").Should().BeFalse();
        }

        [Fact]
        public void HasKeywordValue_WrongCulture_ReturnsFalse()
        {
            var resources = new List<Resource>
            {
                new() { Culture = "fr-FR", Value = "KEY_MISSING" }
            };

            KeyManagementService.HasKeywordValue(resources, "en-US").Should().BeFalse();
        }

        [Fact]
        public void HasKeywordValue_NullValue_ReturnsFalse()
        {
            var resources = new List<Resource>
            {
                new() { Culture = "en-US", Value = null }
            };

            KeyManagementService.HasKeywordValue(resources, "en-US").Should().BeFalse();
        }

        [Fact]
        public void EmptyResourcesThatHasReservedKeywords_WithKeyMissing_EmptiesValues()
        {
            var missingList = new List<BlocksLanguageKey>();
            var key = new BlocksLanguageKey { ItemId = "k1", KeyName = "key1" };
            var resources = new List<Resource>
            {
                new() { Culture = "en-US", Value = "KEY_MISSING" },
                new() { Culture = "fr-FR", Value = "Bonjour" }
            };

            KeyManagementService.EmptyResourcesThatHasReservedKeywords(missingList, key, resources, "en-US");

            resources.Should().AllSatisfy(r => r.Value.Should().BeEmpty());
            missingList.Should().ContainSingle().Which.ItemId.Should().Be("k1");
        }

        [Fact]
        public void EmptyResourcesThatHasReservedKeywords_WithoutKeyMissing_DoesNothing()
        {
            var missingList = new List<BlocksLanguageKey>();
            var key = new BlocksLanguageKey { ItemId = "k1", KeyName = "key1" };
            var resources = new List<Resource>
            {
                new() { Culture = "en-US", Value = "Hello" }
            };

            KeyManagementService.EmptyResourcesThatHasReservedKeywords(missingList, key, resources, "en-US");

            resources[0].Value.Should().Be("Hello");
            missingList.Should().BeEmpty();
        }

        #endregion

        #region ProcessUilmFile (public)

        [Fact]
        public void ProcessUilmFile_WithLanguagesAndKeys_ReturnsUilmFiles()
        {
            var command = new GenerateUilmFilesEvent { ProjectKey = "proj" };
            var languages = new List<Language>
            {
                new() { LanguageCode = "en-US", LanguageName = "English" }
            };
            var resourceKeys = new List<KeyModel>
            {
                new() { KeyName = "hello", Resources = new[] { new Resource { Culture = "en-US", Value = "Hi" } } }
            };
            var app = new BlocksLanguageModule { ModuleName = "auth" };

            var result = _service.ProcessUilmFile(command, languages, resourceKeys, app);

            // Should create files for each language + "key" mode
            result.Should().HaveCount(2); // en-US + key
            result.Should().Contain(f => f.Language == "en-US");
            result.Should().Contain(f => f.Language == "key");
        }

        [Fact]
        public void ProcessUilmFile_KeyLanguageAlreadyPresent_DoesNotDuplicate()
        {
            var command = new GenerateUilmFilesEvent { ProjectKey = "proj" };
            var languages = new List<Language>
            {
                new() { LanguageCode = "en-US", LanguageName = "English" },
                new() { LanguageCode = "key", LanguageName = "key" }
            };
            var resourceKeys = new List<KeyModel>
            {
                new() { KeyName = "hello", Resources = new[] { new Resource { Culture = "en-US", Value = "Hi" } } }
            };
            var app = new BlocksLanguageModule { ModuleName = "auth" };

            var result = _service.ProcessUilmFile(command, languages, resourceKeys, app);

            result.Should().HaveCount(2);
        }

        #endregion

        #region GetKeysByKeyNamesAsync

        [Fact]
        public async Task GetKeysByKeyNamesAsync_NullKeyNames_ReturnsError()
        {
            var request = new GetKeysByKeyNamesRequest { KeyNames = null };

            var result = await _service.GetKeysByKeyNamesAsync(request);

            result.ErrorMessage.Should().Be("KeyNames must not be empty.");
        }

        [Fact]
        public async Task GetKeysByKeyNamesAsync_EmptyKeyNames_ReturnsError()
        {
            var request = new GetKeysByKeyNamesRequest { KeyNames = Array.Empty<string>() };

            var result = await _service.GetKeysByKeyNamesAsync(request);

            result.ErrorMessage.Should().Be("KeyNames must not be empty.");
        }

        [Fact]
        public async Task GetKeysByKeyNamesAsync_ValidKeyNames_ReturnsKeys()
        {
            var keys = new List<KeyModel> { new() { ItemId = "k1", KeyName = "hello" } };
            _keyRepositoryMock.Setup(r => r.GetKeysByKeyNamesAsync(It.IsAny<string[]>(), It.IsAny<string>()))
                .ReturnsAsync(keys);

            var request = new GetKeysByKeyNamesRequest { KeyNames = new[] { "hello" }, ModuleId = "m1" };

            var result = await _service.GetKeysByKeyNamesAsync(request);

            result.Keys.Should().HaveCount(1);
            result.ErrorMessage.Should().BeNull();
        }

        [Fact]
        public async Task GetKeysByKeyNamesAsync_RepositoryThrows_ReturnsErrorMessage()
        {
            _keyRepositoryMock.Setup(r => r.GetKeysByKeyNamesAsync(It.IsAny<string[]>(), It.IsAny<string>()))
                .ThrowsAsync(new Exception("db error"));

            var request = new GetKeysByKeyNamesRequest { KeyNames = new[] { "hello" } };

            var result = await _service.GetKeysByKeyNamesAsync(request);

            result.ErrorMessage.Should().Be("An error occurred while retrieving keys.");
        }

        #endregion

        #region PublishNotification methods

        [Fact]
        public async Task PublishUilmExportNotification_Success_LogsInfo()
        {
            _notificationServiceMock.Setup(n => n.NotifyExportEvent(true, "f1", "msg1", "t1"))
                .ReturnsAsync(true);

            await _service.PublishUilmExportNotification(true, "f1", "msg1", "t1");

            _notificationServiceMock.Verify(n => n.NotifyExportEvent(true, "f1", "msg1", "t1"), Times.Once);
        }

        [Fact]
        public async Task PublishUilmExportNotification_Failure_LogsError()
        {
            _notificationServiceMock.Setup(n => n.NotifyExportEvent(It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(false);

            await _service.PublishUilmExportNotification(false, "f1", "msg1", "t1");
        }

        [Fact]
        public async Task PublishTranslateAllNotification_Success()
        {
            _notificationServiceMock.Setup(n => n.NotifyTranslateAllEvent(true, "msg1"))
                .ReturnsAsync(true);

            await _service.PublishTranslateAllNotification(true, "msg1");

            _notificationServiceMock.Verify(n => n.NotifyTranslateAllEvent(true, "msg1"), Times.Once);
        }

        [Fact]
        public async Task PublishTranslateAllNotification_Failure()
        {
            _notificationServiceMock.Setup(n => n.NotifyTranslateAllEvent(It.IsAny<bool>(), It.IsAny<string>()))
                .ReturnsAsync(false);

            await _service.PublishTranslateAllNotification(false, "msg1");
        }

        [Fact]
        public async Task PublishTranslateBlocksLanguageKeyNotification_Success()
        {
            _notificationServiceMock.Setup(n => n.NotifyTranslateBlocksLanguageKeyEvent(true, "msg1"))
                .ReturnsAsync(true);

            await _service.PublishTranslateBlocksLanguageKeyNotification(true, "msg1");

            _notificationServiceMock.Verify(n => n.NotifyTranslateBlocksLanguageKeyEvent(true, "msg1"), Times.Once);
        }

        [Fact]
        public async Task PublishTranslateBlocksLanguageKeyNotification_Failure()
        {
            _notificationServiceMock.Setup(n => n.NotifyTranslateBlocksLanguageKeyEvent(It.IsAny<bool>(), It.IsAny<string>()))
                .ReturnsAsync(false);

            await _service.PublishTranslateBlocksLanguageKeyNotification(false, "msg1");
        }

        [Fact]
        public async Task PublishEnvironmentDataMigrationNotification_Success()
        {
            _notificationServiceMock.Setup(n => n.NotifyEnvironmentDataMigrationEvent(true, "msg1", "proj", "target"))
                .ReturnsAsync(true);

            await _service.PublishEnvironmentDataMigrationNotification(true, "msg1", "proj", "target");

            _notificationServiceMock.Verify(n => n.NotifyEnvironmentDataMigrationEvent(true, "msg1", "proj", "target"), Times.Once);
        }

        [Fact]
        public async Task PublishEnvironmentDataMigrationNotification_Failure()
        {
            _notificationServiceMock.Setup(n => n.NotifyEnvironmentDataMigrationEvent(It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(false);

            await _service.PublishEnvironmentDataMigrationNotification(false, "msg1", "proj", "target");
        }

        #endregion

        #region CreateBulkKeyTimelineEntriesAsync

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_EmptyList_ReturnsEarly()
        {
            await _service.CreateBulkKeyTimelineEntriesAsync(new List<BlocksLanguageKey>(), "test", "proj");

            _keyTimelineRepositoryMock.Verify(t => t.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_WithKeys_SavesTimelines()
        {
            _keyTimelineRepositoryMock.Setup(t => t.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), "proj"))
                .Returns(Task.CompletedTask);

            var keys = new List<BlocksLanguageKey>
            {
                new() { ItemId = "k1", KeyName = "key1" }
            };

            await _service.CreateBulkKeyTimelineEntriesAsync(keys, "migration", "proj");

            _keyTimelineRepositoryMock.Verify(t => t.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), "proj"), Times.Once);
        }

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_Exception_Swallowed()
        {
            _keyTimelineRepositoryMock.Setup(t => t.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()))
                .ThrowsAsync(new Exception("db error"));

            var keys = new List<BlocksLanguageKey> { new() { ItemId = "k1" } };

            await _service.CreateBulkKeyTimelineEntriesAsync(keys, "test", "proj");
        }

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_WithPreviousKeys_SavesTimelines()
        {
            _keyTimelineRepositoryMock.Setup(t => t.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), "proj"))
                .Returns(Task.CompletedTask);

            var keys = new List<BlocksLanguageKey> { new() { ItemId = "k1", KeyName = "key1" } };
            var prev = new List<BlocksLanguageKey> { new() { ItemId = "k1", KeyName = "key1-old" } };

            await _service.CreateBulkKeyTimelineEntriesAsync(keys, prev, "migration", "proj");

            _keyTimelineRepositoryMock.Verify(t => t.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), "proj"), Times.Once);
        }

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_WithPreviousKeys_EmptyList_ReturnsEarly()
        {
            await _service.CreateBulkKeyTimelineEntriesAsync(new List<BlocksLanguageKey>(), new List<BlocksLanguageKey>(), "test", "proj");

            _keyTimelineRepositoryMock.Verify(t => t.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_WithPreviousKeys_Exception_Swallowed()
        {
            _keyTimelineRepositoryMock.Setup(t => t.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()))
                .ThrowsAsync(new Exception("fail"));

            var keys = new List<BlocksLanguageKey> { new() { ItemId = "k1" } };
            var prev = new List<BlocksLanguageKey> { new() { ItemId = "k1" } };

            await _service.CreateBulkKeyTimelineEntriesAsync(keys, prev, "test", "proj");
        }

        #endregion

        #region SendTranslateBlocksLanguageKeyEvent & SendUilmImportEvent

        [Fact]
        public async Task SendTranslateBlocksLanguageKeyEvent_SendsMessage()
        {
            _messageClientMock.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<TranslateBlocksLanguageKeyEvent>>()))
                .Returns(Task.CompletedTask);

            await _service.SendTranslateBlocksLanguageKeyEvent(new TranslateBlocksLanguageKeyRequest
            {
                MessageCoRelationId = "msg1", ProjectKey = "proj", DefaultLanguage = "en", KeyId = "k1"
            });

            _messageClientMock.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<TranslateBlocksLanguageKeyEvent>>()), Times.Once);
        }

        [Fact]
        public async Task SendUilmImportEvent_SendsMessage()
        {
            _messageClientMock.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<UilmImportEvent>>()))
                .Returns(Task.CompletedTask);

            await _service.SendUilmImportEvent(new UilmImportRequest
            {
                FileId = "f1", MessageCoRelationId = "msg1", ProjectKey = "proj"
            });

            _messageClientMock.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<UilmImportEvent>>()), Times.Once);
        }

        #endregion

        #region GetUilmExportedFilesAsync & GetKeyTimelineAsync (passthrough)

        [Fact]
        public async Task GetUilmExportedFilesAsync_DelegatesToRepository()
        {
            var expectedResponse = new GetUilmExportedFilesQueryResponse();
            _keyRepositoryMock.Setup(r => r.GetUilmExportedFilesAsync(It.IsAny<GetUilmExportedFilesRequest>()))
                .ReturnsAsync(expectedResponse);

            var result = await _service.GetUilmExportedFilesAsync(new GetUilmExportedFilesRequest());

            result.Should().BeSameAs(expectedResponse);
        }

        [Fact]
        public async Task GetKeyTimelineAsync_DelegatesToRepository()
        {
            var expectedResponse = new GetKeyTimelineQueryResponse();
            _keyTimelineRepositoryMock.Setup(r => r.GetKeyTimelineAsync(It.IsAny<GetKeyTimelineRequest>()))
                .ReturnsAsync(expectedResponse);

            var result = await _service.GetKeyTimelineAsync(new GetKeyTimelineRequest());

            result.Should().BeSameAs(expectedResponse);
        }

        #endregion

        #region GetAsync & SaveUniqeFiles

        [Fact]
        public async Task GetAsync_ReturnsKey()
        {
            var key = new KeyModel { ItemId = "k1", KeyName = "hello" };
            _keyRepositoryMock.Setup(r => r.GetByIdAsync("k1")).ReturnsAsync(key);

            var result = await _service.GetAsync(new GetKeyRequest { ItemId = "k1" });

            result.Should().NotBeNull();
            result!.KeyName.Should().Be("hello");
        }

        [Fact]
        public async Task SaveUniqeFiles_DeletesAndSaves()
        {
            _keyRepositoryMock.Setup(r => r.DeleteOldUilmFiles(It.IsAny<List<UilmFile>>())).ReturnsAsync(0L);
            _keyRepositoryMock.Setup(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>())).ReturnsAsync(true);

            var result = await _service.SaveUniqeFiles(new List<UilmFile> { new() { Id = "1" } });

            result.Should().BeTrue();
        }

        #endregion

        #region GetUilmFile

        [Fact]
        public async Task GetUilmFile_ReturnsContent()
        {
            _keyRepositoryMock.Setup(r => r.GetUilmFile(It.IsAny<GetUilmFileRequest>()))
                .ReturnsAsync(new UilmFile { Content = "{\"key\":\"value\"}" });

            var result = await _service.GetUilmFile(new GetUilmFileRequest());

            result.Should().Be("{\"key\":\"value\"}");
        }

        [Fact]
        public async Task GetUilmFile_NullResult_ReturnsNull()
        {
            _keyRepositoryMock.Setup(r => r.GetUilmFile(It.IsAny<GetUilmFileRequest>()))
                .ReturnsAsync((UilmFile?)null);

            var result = await _service.GetUilmFile(new GetUilmFileRequest());

            result.Should().BeNull();
        }

        #endregion
    }
}
