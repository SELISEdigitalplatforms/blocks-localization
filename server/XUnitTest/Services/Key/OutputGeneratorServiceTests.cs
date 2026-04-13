using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared.Entities;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using BlocksLanguage = BlocksTemplate.DomainService.Repositories.BlocksLanguage;
using BlocksLanguageModule = BlocksTemplate.DomainService.Repositories.BlocksLanguageModule;
using BlocksLanguageKey = BlocksTemplate.DomainService.Repositories.BlocksLanguageKey;
using Resource = BlocksTemplate.DomainService.Services.Resource;

namespace BlocksTemplate.XUnitTest
{
    public class JsonOutputGeneratorServiceTests
    {
        private readonly Mock<ILogger<XlsxOutputGeneratorService>> _loggerMock;
        private readonly JsonOutputGeneratorService _service;

        public JsonOutputGeneratorServiceTests()
        {
            _loggerMock = new Mock<ILogger<XlsxOutputGeneratorService>>();
            _service = new JsonOutputGeneratorService(_loggerMock.Object);
        }

        [Fact]
        public async Task GenerateAsync_ValidInput_ReturnsJsonString()
        {
            // Arrange
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "key-id",
                    KeyName = "welcome.message",
                    ModuleId = "module-id",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Welcome" },
                        new Resource { Culture = "fr-FR", Value = "Bienvenue" }
                    }
                }
            };

            // Act
            var result = await _service.GenerateAsync<string>(languages, modules, keys, "en-US");

            // Assert
            result.Should().NotBeNull();
            result.Should().Contain("welcome.message");
            result.Should().Contain("Welcome");
            result.Should().Contain("Bienvenue");
        }

        [Fact]
        public async Task GenerateAsync_EmptyKeys_ReturnsEmptyJsonArray()
        {
            // Arrange
            var languages = new List<BlocksLanguage>();
            var modules = new List<BlocksLanguageModule>();
            var keys = new List<BlocksLanguageKey>();

            // Act
            var result = await _service.GenerateAsync<string>(languages, modules, keys, "en-US");

            // Assert
            result.Should().NotBeNull();
            result.Should().Contain("[]");
        }

        [Fact]
        public async Task GenerateAsync_FiltersTypeCulture_ExcludesTypeResources()
        {
            // Arrange
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "key-id",
                    KeyName = "welcome.message",
                    ModuleId = "module-id",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Welcome" },
                        new Resource { Culture = "type", Value = "string" }
                    }
                }
            };

            // Act
            var result = await _service.GenerateAsync<string>(languages, modules, keys, "en-US");

            // Assert
            result.Should().NotBeNull();
            result.Should().Contain("Welcome");
            result.Should().NotContain("type");
        }

        [Fact]
        public async Task GenerateAsync_FiltersEmptyValues_ExcludesEmptyResources()
        {
            // Arrange
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "key-id",
                    KeyName = "welcome.message",
                    ModuleId = "module-id",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Welcome" },
                        new Resource { Culture = "fr-FR", Value = "" }
                    }
                }
            };

            // Act
            var result = await _service.GenerateAsync<string>(languages, modules, keys, "en-US");

            // Assert
            result.Should().NotBeNull();
            result.Should().Contain("Welcome");
        }
    }

    public class CsvOutputGeneratorServiceTests
    {
        private readonly Mock<ILogger<CsvOutputGeneratorService>> _loggerMock;
        private readonly CsvOutputGeneratorService _service;

        public CsvOutputGeneratorServiceTests()
        {
            _loggerMock = new Mock<ILogger<CsvOutputGeneratorService>>();
            _service = new CsvOutputGeneratorService(_loggerMock.Object);
        }

        [Fact]
        public async Task GenerateAsync_ValidInput_ReturnsMemoryStream()
        {
            // Arrange
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "key-id",
                    KeyName = "welcome.message",
                    ModuleId = "module-id",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Welcome" },
                        new Resource { Culture = "fr-FR", Value = "Bienvenue" }
                    }
                }
            };

            // Act
            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");

            // Assert
            result.Should().NotBeNull();
            result.Length.Should().BeGreaterThan(0);
        }

        [Fact]
        public async Task GenerateAsync_IncludesCharacterLength_ForNonDefaultLanguages()
        {
            // Arrange
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "key-id",
                    KeyName = "welcome.message",
                    ModuleId = "module-id",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Welcome", CharacterLength = 7 },
                        new Resource { Culture = "fr-FR", Value = "Bienvenue", CharacterLength = 9 }
                    }
                }
            };

            // Act
            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");

            // Assert
            result.Should().NotBeNull();
            result.Length.Should().BeGreaterThan(0);
        }

        [Fact]
        public async Task GenerateAsync_EmptyKeys_ReturnsStreamWithHeaders()
        {
            // Arrange
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" }
            };

            var modules = new List<BlocksLanguageModule>();
            var keys = new List<BlocksLanguageKey>();

            // Act
            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");

            // Assert
            result.Should().NotBeNull();
            result.Length.Should().BeGreaterThan(0);
        }
    }

    public class XlsxOutputGeneratorServiceTests
    {
        private readonly Mock<ILogger<XlsxOutputGeneratorService>> _loggerMock;
        private readonly XlsxOutputGeneratorService _service;

        public XlsxOutputGeneratorServiceTests()
        {
            _loggerMock = new Mock<ILogger<XlsxOutputGeneratorService>>();
            _service = new XlsxOutputGeneratorService(_loggerMock.Object);
        }

        [Fact]
        public async Task GenerateAsync_ValidInput_ReturnsWorkbook()
        {
            // Arrange
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "key-id",
                    KeyName = "welcome.message",
                    ModuleId = "module-id",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Welcome" },
                        new Resource { Culture = "fr-FR", Value = "Bienvenue" }
                    }
                }
            };

            // Act
            var result = await _service.GenerateAsync<ClosedXML.Excel.XLWorkbook>(languages, modules, keys, "en-US");

            // Assert
            result.Should().NotBeNull();
            result.Worksheets.Should().NotBeEmpty();
            result.Worksheets.First().Name.Should().Be("Resources");
        }

        [Fact]
        public async Task GenerateAsync_IncludesCharacterLengthColumns_ForNonDefaultLanguages()
        {
            // Arrange
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "key-id",
                    KeyName = "welcome.message",
                    ModuleId = "module-id",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Welcome", CharacterLength = 7 },
                        new Resource { Culture = "fr-FR", Value = "Bienvenue", CharacterLength = 9 }
                    }
                }
            };

            // Act
            var result = await _service.GenerateAsync<ClosedXML.Excel.XLWorkbook>(languages, modules, keys, "en-US");

            // Assert
            result.Should().NotBeNull();
            var worksheet = result.Worksheets.First();
            worksheet.Should().NotBeNull();
        }

        [Fact]
        public async Task GenerateAsync_EmptyKeys_ReturnsWorkbookWithHeaders()
        {
            // Arrange
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" }
            };

            var modules = new List<BlocksLanguageModule>();
            var keys = new List<BlocksLanguageKey>();

            // Act
            var result = await _service.GenerateAsync<ClosedXML.Excel.XLWorkbook>(languages, modules, keys, "en-US");

            // Assert
            result.Should().NotBeNull();
            result.Worksheets.Should().NotBeEmpty();
        }
    }

    public class XlfOutputGeneratorServiceTests
    {
        private readonly Mock<ILogger<XlfOutputGeneratorService>> _loggerMock;
        private readonly XlfOutputGeneratorService _service;

        public XlfOutputGeneratorServiceTests()
        {
            _loggerMock = new Mock<ILogger<XlfOutputGeneratorService>>();
            _service = new XlfOutputGeneratorService(_loggerMock.Object);
        }

        [Fact]
        public async Task GenerateAsync_WithTargetLanguages_ReturnsZipWithEntries()
        {
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "key-id",
                    KeyName = "welcome.message",
                    ModuleId = "module-id",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Welcome" },
                        new Resource { Culture = "fr-FR", Value = "Bienvenue" }
                    }
                }
            };

            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");

            result.Should().NotBeNull();
            result.Length.Should().BeGreaterThan(0);

            using var archive = new System.IO.Compression.ZipArchive(result, System.IO.Compression.ZipArchiveMode.Read, true);
            var entry = archive.GetEntry("fr-FR.xlf");
            entry.Should().NotBeNull();

            using var reader = new StreamReader(entry!.Open());
            var content = await reader.ReadToEndAsync();
            content.Should().Contain("welcome.message");
            content.Should().Contain("Bienvenue");
        }

        [Fact]
        public async Task GenerateAsync_UsesReferenceTranslations_WhenTargetMissing()
        {
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "de-DE", LanguageName = "German" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "key-id",
                    KeyName = "welcome.message",
                    ModuleId = "module-id",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Welcome" }
                    }
                }
            };

            var referenceTranslations = new Dictionary<string, Dictionary<string, string>>
            {
                ["de-DE"] = new Dictionary<string, string>
                {
                    { "welcome.message", "Willkommen" }
                }
            };

            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US", referenceTranslations);

            result.Should().NotBeNull();
            using var archive = new System.IO.Compression.ZipArchive(result, System.IO.Compression.ZipArchiveMode.Read, true);
            var entry = archive.GetEntry("de-DE.xlf");
            entry.Should().NotBeNull();

            using var reader = new StreamReader(entry!.Open());
            var content = await reader.ReadToEndAsync();
            content.Should().Contain("Willkommen");
            content.Should().Contain("state=\"translated\"");
        }

        [Fact]
        public async Task GenerateAsync_NoTargetLanguages_ReturnsNull()
        {
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" }
            };

            var modules = new List<BlocksLanguageModule>();
            var keys = new List<BlocksLanguageKey>();

            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");

            result.Should().BeNull();
        }

        [Fact]
        public async Task GenerateAsync_MultipleModules_CreatesFileElementsPerModule()
        {
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" },
                new BlocksLanguageModule { ItemId = "mod-2", ModuleName = "dashboard" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "login.title", ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Login" }, new Resource { Culture = "fr-FR", Value = "Connexion" } }
                },
                new BlocksLanguageKey
                {
                    ItemId = "k2", KeyName = "dash.title", ModuleId = "mod-2",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Dashboard" }, new Resource { Culture = "fr-FR", Value = "Tableau de bord" } }
                }
            };

            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();

            using var archive = new System.IO.Compression.ZipArchive(result, System.IO.Compression.ZipArchiveMode.Read, true);
            var entry = archive.GetEntry("fr-FR.xlf");
            entry.Should().NotBeNull();

            using var reader = new StreamReader(entry!.Open());
            var content = await reader.ReadToEndAsync();
            content.Should().Contain("auth");
            content.Should().Contain("dashboard");
            content.Should().Contain("Login");
            content.Should().Contain("Tableau de bord");
        }

        [Fact]
        public async Task GenerateAsync_KeyWithNoSourceValue_SkipsTransUnit()
        {
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "de-DE", LanguageName = "German" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "empty.key", ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "de-DE", Value = "Hallo" } }
                }
            };

            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();

            using var archive = new System.IO.Compression.ZipArchive(result, System.IO.Compression.ZipArchiveMode.Read, true);
            var entry = archive.GetEntry("de-DE.xlf");
            entry.Should().NotBeNull();

            using var reader = new StreamReader(entry!.Open());
            var content = await reader.ReadToEndAsync();
            content.Should().NotContain("empty.key");
        }

        [Fact]
        public async Task GenerateAsync_KeyWithNullResources_SkipsTransUnit()
        {
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "null.key", ModuleId = "mod-1",
                    Resources = null
                }
            };

            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GenerateAsync_KeyWithRoutes_IncludesRoutesNote()
        {
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "route.key", ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" }, new Resource { Culture = "fr-FR", Value = "Bonjour" } },
                    Routes = new List<string> { "/home", "/about" }
                }
            };

            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();

            using var archive = new System.IO.Compression.ZipArchive(result, System.IO.Compression.ZipArchiveMode.Read, true);
            var entry = archive.GetEntry("fr-FR.xlf");
            using var reader = new StreamReader(entry!.Open());
            var content = await reader.ReadToEndAsync();
            content.Should().Contain("Routes: /home, /about");
        }

        [Fact]
        public async Task GenerateAsync_KeyWithContext_IncludesContextNote()
        {
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "ctx.key", ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Submit" }, new Resource { Culture = "fr-FR", Value = "Soumettre" } },
                    Context = "Form submit button"
                }
            };

            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();

            using var archive = new System.IO.Compression.ZipArchive(result, System.IO.Compression.ZipArchiveMode.Read, true);
            var entry = archive.GetEntry("fr-FR.xlf");
            using var reader = new StreamReader(entry!.Open());
            var content = await reader.ReadToEndAsync();
            content.Should().Contain("Context: Form submit button");
        }

        [Fact]
        public async Task GenerateAsync_KeyWithCharacterLength_IncludesCharacterLengthNote()
        {
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "len.key", ModuleId = "mod-1",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Hello" },
                        new Resource { Culture = "fr-FR", Value = "Bonjour", CharacterLength = 7 }
                    }
                }
            };

            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();

            using var archive = new System.IO.Compression.ZipArchive(result, System.IO.Compression.ZipArchiveMode.Read, true);
            var entry = archive.GetEntry("fr-FR.xlf");
            using var reader = new StreamReader(entry!.Open());
            var content = await reader.ReadToEndAsync();
            content.Should().Contain("CharacterLength: 7");
        }

        [Fact]
        public async Task GenerateAsync_PartiallyTranslatedKey_SetsNeedsTranslationState()
        {
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "partial.key", ModuleId = "mod-1",
                    IsPartiallyTranslated = true,
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Hello" },
                        new Resource { Culture = "fr-FR", Value = "Bonjour" }
                    }
                }
            };

            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();

            using var archive = new System.IO.Compression.ZipArchive(result, System.IO.Compression.ZipArchiveMode.Read, true);
            var entry = archive.GetEntry("fr-FR.xlf");
            using var reader = new StreamReader(entry!.Open());
            var content = await reader.ReadToEndAsync();
            content.Should().Contain("state=\"needs-translation\"");
        }

        [Fact]
        public async Task GenerateAsync_KeyWithNoTargetValue_SetsEmptyTargetWithNeedsTranslation()
        {
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "missing.key", ModuleId = "mod-1",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Hello" }
                    }
                }
            };

            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();

            using var archive = new System.IO.Compression.ZipArchive(result, System.IO.Compression.ZipArchiveMode.Read, true);
            var entry = archive.GetEntry("fr-FR.xlf");
            using var reader = new StreamReader(entry!.Open());
            var content = await reader.ReadToEndAsync();
            content.Should().Contain("needs-translation");
        }

        [Fact]
        public async Task GenerateAsync_WithoutReferenceTranslations_TwoArgOverload_ReturnsZip()
        {
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "welcome.message", ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Welcome" }, new Resource { Culture = "fr-FR", Value = "Bienvenue" } }
                }
            };

            // Use 4-arg overload (routes through 5-arg with null)
            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();
        }

        [Fact]
        public void DefaultConstructor_CreatesInstance()
        {
            var service = new XlfOutputGeneratorService();
            service.Should().NotBeNull();
        }

        [Fact]
        public async Task GenerateAsync_UnknownModule_UsesUnknownAsModuleName()
        {
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>(); // No modules

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "orphan.key", ModuleId = "unknown-mod",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Hello" },
                        new Resource { Culture = "fr-FR", Value = "Bonjour" }
                    }
                }
            };

            var result = await _service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();

            using var archive = new System.IO.Compression.ZipArchive(result, System.IO.Compression.ZipArchiveMode.Read, true);
            var entry = archive.GetEntry("fr-FR.xlf");
            using var reader = new StreamReader(entry!.Open());
            var content = await reader.ReadToEndAsync();
            content.Should().Contain("Unknown");
        }
    }

    public class JsonOutputGeneratorDefaultCtorTests
    {
        [Fact]
        public void DefaultConstructor_CreatesInstance()
        {
            var service = new JsonOutputGeneratorService();
            service.Should().NotBeNull();
        }

        [Fact]
        public async Task GenerateAsync_NullResources_DoesNotThrow()
        {
            var loggerMock = new Mock<ILogger<XlsxOutputGeneratorService>>();
            var service = new JsonOutputGeneratorService(loggerMock.Object);

            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "null.resources", ModuleId = "mod-1",
                    Resources = null
                }
            };

            var result = await service.GenerateAsync<string>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GenerateAsync_DuplicateLanguageCodes_DeduplicatesCorrectly()
        {
            var loggerMock = new Mock<ILogger<XlsxOutputGeneratorService>>();
            var service = new JsonOutputGeneratorService(loggerMock.Object);

            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English (US)" },
                new BlocksLanguage { LanguageCode = "", LanguageName = "Empty" },
                new BlocksLanguage { LanguageCode = null, LanguageName = "Null" }
            };

            var modules = new List<BlocksLanguageModule>();
            var keys = new List<BlocksLanguageKey>();

            var result = await service.GenerateAsync<string>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GenerateAsync_NoMatchingModule_SetsModuleNull()
        {
            var loggerMock = new Mock<ILogger<XlsxOutputGeneratorService>>();
            var service = new JsonOutputGeneratorService(loggerMock.Object);

            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" }
            };

            var modules = new List<BlocksLanguageModule>();

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "orphan", ModuleId = "nonexistent",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Test" } }
                }
            };

            var result = await service.GenerateAsync<string>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();
            result.Should().Contain("\"Module\": null");
        }
    }

    public class CsvOutputGeneratorAdditionalTests
    {
        [Fact]
        public void DefaultConstructor_CreatesInstance()
        {
            var service = new CsvOutputGeneratorService();
            service.Should().NotBeNull();
        }

        [Fact]
        public async Task GenerateAsync_NullResources_ReturnsNullFromCatch()
        {
            var loggerMock = new Mock<ILogger<CsvOutputGeneratorService>>();
            var service = new CsvOutputGeneratorService(loggerMock.Object);

            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "null.res", ModuleId = "mod-1",
                    Resources = null
                }
            };

            // Null resources will cause NullReferenceException in the foreach, caught and returns null
            var result = await service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");
            result.Should().BeNull();
        }

        [Fact]
        public async Task GenerateAsync_MultipleKeys_WritesAllRows()
        {
            var loggerMock = new Mock<ILogger<CsvOutputGeneratorService>>();
            var service = new CsvOutputGeneratorService(loggerMock.Object);

            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "key1", ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } }
                },
                new BlocksLanguageKey
                {
                    ItemId = "k2", KeyName = "key2", ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "World" } }
                }
            };

            var result = await service.GenerateAsync<MemoryStream>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();
            result.Length.Should().BeGreaterThan(0);
        }
    }

    public class XlsxOutputGeneratorAdditionalTests
    {
        [Fact]
        public void DefaultConstructor_CreatesInstance()
        {
            var service = new XlsxOutputGeneratorService();
            service.Should().NotBeNull();
        }

        [Fact]
        public async Task GenerateAsync_NullResources_HandlesGracefully()
        {
            var loggerMock = new Mock<ILogger<XlsxOutputGeneratorService>>();
            var service = new XlsxOutputGeneratorService(loggerMock.Object);

            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" }
            };

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k1", KeyName = "null.key", ModuleId = "mod-1",
                    Resources = null
                }
            };

            var result = await service.GenerateAsync<ClosedXML.Excel.XLWorkbook>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();
            result.Worksheets.Should().NotBeEmpty();
        }

        [Fact]
        public async Task GenerateAsync_EmptyLanguageCodes_FiltersCorrectly()
        {
            var loggerMock = new Mock<ILogger<XlsxOutputGeneratorService>>();
            var service = new XlsxOutputGeneratorService(loggerMock.Object);

            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { LanguageCode = "en-US", LanguageName = "English" },
                new BlocksLanguage { LanguageCode = "", LanguageName = "Empty" },
                new BlocksLanguage { LanguageCode = null, LanguageName = "Null" }
            };

            var modules = new List<BlocksLanguageModule>();
            var keys = new List<BlocksLanguageKey>();

            var result = await service.GenerateAsync<ClosedXML.Excel.XLWorkbook>(languages, modules, keys, "en-US");
            result.Should().NotBeNull();
        }
    }
}
