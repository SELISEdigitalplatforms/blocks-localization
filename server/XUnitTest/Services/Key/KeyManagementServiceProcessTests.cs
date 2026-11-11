using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Shared.Events;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using System.Linq;
using Xunit;
using KeyModel = Eurolm.DomainService.Services.Key;
using Eurolm.DomainService.Services.UilmStorage;

namespace XUnitTest
{
    public class KeyManagementServiceProcessTests
    {
        private readonly Mock<IKeyRepository> _keyRepositoryMock;
        private readonly Mock<IKeyTimelineRepository> _keyTimelineRepositoryMock;
        private readonly Mock<ILanguageFileGenerationHistoryRepository> _languageFileGenerationHistoryRepositoryMock;
        private readonly Mock<IAssistantService> _assistantServiceMock;
        private readonly Mock<ILanguageManagementService> _languageServiceMock;
        private readonly Mock<IModuleManagementService> _moduleServiceMock;
        private readonly KeyManagementService _service;

        public KeyManagementServiceProcessTests()
        {
            _keyRepositoryMock = new Mock<IKeyRepository>();
            _keyTimelineRepositoryMock = new Mock<IKeyTimelineRepository>();
            _languageFileGenerationHistoryRepositoryMock = new Mock<ILanguageFileGenerationHistoryRepository>();
            var validatorMock = new Mock<IValidator<KeyModel>>();
            var loggerMock = new Mock<ILogger<KeyManagementService>>();
            _languageServiceMock = new Mock<ILanguageManagementService>();
            _moduleServiceMock = new Mock<IModuleManagementService>();
            var messageClientMock = new Mock<IMessageClient>();
            _assistantServiceMock = new Mock<IAssistantService>();
            var storageDriverServiceMock = new Mock<IStorageDriverService>();
            var notificationServiceMock = new Mock<INotificationService>();
            var storageLogger = new Mock<ILogger<StorageHelper>>();
            var storageHelper = new StorageHelper(storageLogger.Object, storageDriverServiceMock.Object);

            _assistantServiceMock.Setup(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()))
                .ReturnsAsync(new SuggestionResult { Content = "Bonjour" });

            _service = new KeyManagementService(
                _keyRepositoryMock.Object,
                _keyTimelineRepositoryMock.Object,
                _languageFileGenerationHistoryRepositoryMock.Object,
                validatorMock.Object,
                loggerMock.Object,
                _languageServiceMock.Object,
                _moduleServiceMock.Object,
                messageClientMock.Object,
                _assistantServiceMock.Object,
                storageDriverServiceMock.Object,
                storageHelper,
                Mock.Of<IServiceProvider>(),
                notificationServiceMock.Object,
                Mock.Of<IGlossaryRepository>(),
                Mock.Of<IUilmFilePublisher>()
            );
        }

        [Fact]
        public async Task ProcessResourceKey_AddsMissingTranslationAndReturnsEntry()
        {
            var request = new TranslateAllEvent
            {
                DefaultLanguage = "en-US",
                ProjectKey = "proj"
            };

            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" },
                new Language { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var resourceKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                ModuleId = "module-1",
                KeyName = "welcome",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Hello" },
                    new Resource { Culture = "fr-FR", Value = "" }
                }
            };

            var list = new List<BlocksLanguageKey>();

            await _service.ProcessResourceKey(request, resourceKey, languages, list);

            list.Should().Contain(resourceKey);
            resourceKey.Resources.Any(r => r.Culture == "fr-FR" && r.Value == "Bonjour").Should().BeTrue();
        }

        private static readonly List<Language> EnFr = new()
        {
            new Language { LanguageCode = "en-US", LanguageName = "English" },
            new Language { LanguageCode = "fr-FR", LanguageName = "French" }
        };

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public async Task ProcessResourceKey_SkipsKeyWithoutDefaultText_WithoutCallingAi(string? defaultValue)
        {
            var resourceKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                KeyName = "welcome",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = defaultValue },
                    new Resource { Culture = "fr-FR", Value = "" }
                }
            };
            var list = new List<BlocksLanguageKey>();

            await _service.ProcessResourceKey(new TranslateAllEvent { DefaultLanguage = "en-US" }, resourceKey, EnFr, list);

            list.Should().BeEmpty();
            _assistantServiceMock.Verify(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()), Times.Never);
        }

        [Fact]
        public async Task ProcessResourceKey_TranslatesValueEqualToKeyName()
        {
            var resourceKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                KeyName = "Cancel",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Cancel" },
                    new Resource { Culture = "fr-FR", Value = "" }
                }
            };
            var list = new List<BlocksLanguageKey>();

            await _service.ProcessResourceKey(new TranslateAllEvent { DefaultLanguage = "en-US" }, resourceKey, EnFr, list);

            list.Should().Contain(resourceKey);
            _assistantServiceMock.Verify(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()), Times.Once);
        }

        [Fact]
        public async Task ProcessResourceKey_KeyMissingKeyword_IsStillSavedBlankedButNotTranslated()
        {
            var resourceKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                KeyName = "welcome",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "KEY_MISSING" },
                    new Resource { Culture = "fr-FR", Value = "Bonjour" }
                }
            };
            var list = new List<BlocksLanguageKey>();

            await _service.ProcessResourceKey(new TranslateAllEvent { DefaultLanguage = "en-US" }, resourceKey, EnFr, list);

            list.Should().ContainSingle().Which.Should().BeSameAs(resourceKey);
            resourceKey.Resources.Should().OnlyContain(r => r.Value == "");
            _assistantServiceMock.Verify(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()), Times.Never);
        }

        [Fact]
        public async Task ProcessChangeAll_AddsTranslationsForEachKey()
        {
            var request = new TranslateAllEvent
            {
                DefaultLanguage = "en-US",
                ProjectKey = "proj"
            };

            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" },
                new Language { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var resourceKeys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "key-1",
                    ModuleId = "module-1",
                    KeyName = "welcome",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Hello" },
                        new Resource { Culture = "fr-FR", Value = "" }
                    }
                },
                new BlocksLanguageKey
                {
                    ItemId = "key-2",
                    ModuleId = "module-1",
                    KeyName = "bye",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Bye" },
                        new Resource { Culture = "fr-FR", Value = "" }
                    }
                }
            };

            _languageServiceMock.Setup(l => l.GetLanguagesAsync())
                .ReturnsAsync(languages);

            var result = await _service.ProcessChangeAll(request, resourceKeys.AsQueryable(), languages);

            result.Should().HaveCount(2);
            result.All(k => k.Resources.Any(r => r.Culture == "fr-FR" && !string.IsNullOrEmpty(r.Value))).Should().BeTrue();
        }

        [Fact]
        public async Task ProcessChangeAll_StartsEveryAiCallTogether_AndPutsEachAnswerOnItsOwnKeyAndLanguage()
        {
            var request = new TranslateAllEvent { DefaultLanguage = "en-US", ProjectKey = "proj" };
            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" },
                new Language { LanguageCode = "fr-FR", LanguageName = "French" },
                new Language { LanguageCode = "de-DE", LanguageName = "German" }
            };
            var resourceKeys = new[] { "Hello", "Bye", "Save" }.Select((text, i) => new BlocksLanguageKey
            {
                ItemId = $"key-{i}",
                ModuleId = "module-1",
                KeyName = text,
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = text },
                    new Resource { Culture = "fr-FR", Value = "" }
                    // de-DE has no resource yet: it is added for the language setting.
                }
            }).ToList();

            var pending = new List<(SuggestLanguageRequest Query, TaskCompletionSource<SuggestionResult> Answer)>();
            _assistantServiceMock.Setup(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()))
                .Returns((SuggestLanguageRequest query) =>
                {
                    var answer = new TaskCompletionSource<SuggestionResult>();
                    pending.Add((query, answer));
                    return answer.Task;
                });

            var processing = _service.ProcessChangeAll(request, resourceKeys.AsQueryable(), languages);

            // Every call has started before any has answered: 3 keys x 2 languages.
            pending.Should().HaveCount(6);
            processing.IsCompleted.Should().BeFalse();

            // Answer in reverse order; each answer must still land on the key and language it was asked for.
            foreach (var (query, answer) in Enumerable.Reverse(pending))
            {
                answer.SetResult(new SuggestionResult { Content = $"{query.SourceText}@{query.DestinationLanguageCode}" });
            }
            var result = await processing;

            result.Select(k => k.ItemId).Should().Equal("key-0", "key-1", "key-2");
            foreach (var key in result)
            {
                key.Resources.Select(r => r.Culture).Should().Equal("en-US", "fr-FR", "de-DE");
                key.Resources.Single(r => r.Culture == "fr-FR").Value.Should().Be($"{key.KeyName}@fr-FR");
                key.Resources.Single(r => r.Culture == "de-DE").Value.Should().Be($"{key.KeyName}@de-DE");
            }
        }

        [Fact]
        public async Task ProcessChangeAll_KeepsTheReservedKeywordKeyAndSkipsTheBlankOne_WithoutCallingAi()
        {
            var request = new TranslateAllEvent { DefaultLanguage = "en-US" };
            var resourceKeys = new List<BlocksLanguageKey>
            {
                new() { ItemId = "reserved", KeyName = "r", Resources = new[] { new Resource { Culture = "en-US", Value = "KEY_MISSING" }, new Resource { Culture = "fr-FR", Value = "x" } } },
                new() { ItemId = "blank", KeyName = "b", Resources = new[] { new Resource { Culture = "en-US", Value = " " }, new Resource { Culture = "fr-FR", Value = "" } } },
                new() { ItemId = "done", KeyName = "d", Resources = new[] { new Resource { Culture = "en-US", Value = "Hi" }, new Resource { Culture = "fr-FR", Value = "Salut" } } }
            };

            var result = await _service.ProcessChangeAll(request, resourceKeys.AsQueryable(), EnFr);

            result.Select(k => k.ItemId).Should().Equal("reserved");
            result[0].Resources.Should().OnlyContain(r => r.Value == "");
            _assistantServiceMock.Verify(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()), Times.Never);
        }

        [Fact]
        public async Task UpdateResourceKey_CreatesTimelines()
        {
            var resourceKey = new BlocksLanguageKey
            {
                ItemId = "id-1",
                ModuleId = "module-1",
                KeyName = "welcome",
                Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } }
            };

            _keyRepositoryMock.Setup(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()))
                .ReturnsAsync(1);
            await _service.UpdateResourceKey(new List<BlocksLanguageKey> { resourceKey }, new TranslateAllEvent(), new Dictionary<string, BlocksLanguageKey>());

            _keyTimelineRepositoryMock.Verify(t => t.BulkSaveKeyTimelinesAsync(
                It.Is<List<KeyTimeline>>(l => l.Count == 1 && l[0].EntityId == "id-1" && l[0].CurrentData == resourceKey),
                It.IsAny<string>()), Times.Once);
            _keyTimelineRepositoryMock.Verify(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Never);
        }

        [Fact]
        public async Task ChangeAll_ReturnsTrueWhenNoResources()
        {
            _keyRepositoryMock.Setup(r => r.GetUilmResourceKeysWithPage(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<string?>()))
                .ReturnsAsync(new List<BlocksLanguageKey>().AsQueryable());
            _languageServiceMock.Setup(l => l.GetLanguagesAsync())
                .ReturnsAsync(new List<Language>());

            var result = await _service.ChangeAll(new TranslateAllEvent { DefaultLanguage = "en-US" });

            result.Should().BeTrue();
        }

        [Fact]
        public void ConstructQuery_BuildsRequestWithLanguageNames()
        {
            var request = new TranslateAllEvent
            {
                DefaultLanguage = "en-US",
                ProjectKey = "proj"
            };

            var languageSetting = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" },
                new Language { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var resourceKey = new BlocksLanguageKey
            {
                KeyName = "welcome",
                Context = "button"
            };

            var defaultResource = new Resource { Culture = "en-US", Value = "Hello" };
            var missingResource = new Resource { Culture = "fr-FR" };

            var query = KeyManagementService.ConstructQuery(request, resourceKey, defaultResource, missingResource, "French", languageSetting);

            query.DestinationLanguage.Should().Be("French");
            query.CurrentLanguage.Should().Be("English");
            query.ElementDetailContext.Should().Be("button");
            query.SourceText.Should().Be("Hello");
        }
    }
}

