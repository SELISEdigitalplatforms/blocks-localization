using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using Moq;
using Xunit;

namespace XUnitTest
{
    public class GlossaryValidatorStructuredTests
    {
        private readonly Mock<IGlossaryRepository> _repository = new();
        private readonly GlossaryValidator _validator;

        public GlossaryValidatorStructuredTests()
        {
            _repository.Setup(r => r.GetByNameInsensitiveAsync(It.IsAny<string>())).ReturnsAsync(new List<Glossary>());
            _validator = new GlossaryValidator(_repository.Object);
        }

        private async Task<IEnumerable<string>> Errors(Glossary glossary) =>
            (await _validator.ValidateAsync(glossary)).Errors.Select(e => $"{e.PropertyName}: {e.ErrorMessage}");

        [Fact]
        public async Task Omitted_structured_fields_are_not_validated()
        {
            (await Errors(new Glossary { Name = "Workspace" })).Should().BeEmpty();
        }

        [Theory]
        [InlineData("translate")]
        [InlineData("keep")]
        [InlineData("forbidden")]
        public async Task Known_rules_are_accepted(string rule)
        {
            (await Errors(new Glossary { Name = "Workspace", Rule = rule })).Should().BeEmpty();
        }

        [Fact]
        public async Task Unknown_rule_is_rejected()
        {
            (await Errors(new Glossary { Name = "Workspace", Rule = "replace" }))
                .Should().ContainSingle().Which.Should().Be("Rule: Rule must be translate, keep or forbidden.");
        }

        [Fact]
        public async Task Unknown_status_is_rejected()
        {
            (await Errors(new Glossary { Name = "Workspace", Status = "review" }))
                .Should().ContainSingle().Which.Should().Be("Status: Status must be draft, approved or deprecated.");
        }

        public static TheoryData<List<string>> InvalidVariants => new()
        {
            Enumerable.Range(0, 21).Select(i => $"v{i}").ToList(),
            new List<string> { "" },
            new List<string> { new string('a', 201) },
            new List<string> { "Workspaces", " workspaces " },
            new List<string> { " WORKSPACE " }
        };

        [Theory]
        [MemberData(nameof(InvalidVariants))]
        public async Task Invalid_variants_are_rejected(List<string> variants)
        {
            (await Errors(new Glossary { Name = "Workspace", Variants = variants }))
                .Should().ContainSingle().Which.Should().Be("Variants: Variants are invalid.");
        }

        [Fact]
        public async Task Valid_variants_are_accepted()
        {
            (await Errors(new Glossary { Name = "Workspace", Variants = Enumerable.Range(0, 20).Select(i => $"v{i}").ToList() }))
                .Should().BeEmpty();
        }

        public static TheoryData<List<GlossaryTranslationDto>> InvalidTranslations => new()
        {
            new() { new() { Language = "de-DE", Value = "a" }, new() { Language = "de-de", Value = "b" } },
            new() { new() { Language = "", Value = "a" } },
            new() { new() { Language = "de-DE", Value = new string('a', 201) } },
            new() { new() { Language = "de-DE", Value = "a", ForbiddenValues = Enumerable.Range(0, 11).Select(i => $"f{i}").ToList() } },
            new() { new() { Language = "de-DE", Value = "a", ForbiddenValues = new() { "" } } },
            new() { new() { Language = "de-DE", Value = "Arbeitsbereich", ForbiddenValues = new() { " ARBEITSBEREICH " } } }
        };

        [Theory]
        [MemberData(nameof(InvalidTranslations))]
        public async Task Invalid_translations_are_rejected(List<GlossaryTranslationDto> translations)
        {
            (await Errors(new Glossary { Name = "Workspace", Translations = translations }))
                .Should().ContainSingle().Which.Should().Be("Translations: Translations are invalid.");
        }

        [Fact]
        public async Task Translations_for_cultures_outside_the_project_and_forbidden_only_entries_are_accepted()
        {
            (await Errors(new Glossary
            {
                Name = "Workspace",
                Translations = new()
                {
                    new() { Language = "it-IT", Value = "Area di lavoro" },
                    new() { Language = "de-DE", Value = "", ForbiddenValues = new() { "Werkbereich" } }
                }
            })).Should().BeEmpty();
        }

        [Fact]
        public async Task Long_context_is_rejected_on_create()
        {
            (await Errors(new Glossary { Name = "Workspace", Context = new string('a', 1601) }))
                .Should().ContainSingle().Which.Should().Be("Context: Context must be 1,600 characters or fewer.");
        }

        [Fact]
        public async Task Long_additional_note_is_rejected_on_create()
        {
            (await Errors(new Glossary { Name = "Workspace", AdditionalNote = new string('a', 20001) }))
                .Should().ContainSingle().Which.Should().Be("AdditionalNote: Additional note must be 20,000 characters or fewer.");
        }

        [Fact]
        public async Task Long_legacy_values_saved_unchanged_are_accepted()
        {
            // Example 11: the CLI resends a 2,400-character legacy context unchanged.
            var context = new string('c', 2400);
            var note = new string('n', 25000);
            _repository.Setup(r => r.GetStoredByIdAsync("g1"))
                .ReturnsAsync(new BlocksGlossary { ItemId = "g1", Name = "Workspace", Context = context, AdditionalNote = note });

            (await Errors(new Glossary { ItemId = "g1", Name = "Workspace", Context = context, AdditionalNote = note }))
                .Should().BeEmpty();
        }

        [Fact]
        public async Task Long_legacy_context_that_changes_is_rejected()
        {
            _repository.Setup(r => r.GetStoredByIdAsync("g1"))
                .ReturnsAsync(new BlocksGlossary { ItemId = "g1", Name = "Workspace", Context = new string('c', 2400) });

            (await Errors(new Glossary { ItemId = "g1", Name = "Workspace", Context = new string('d', 2400) }))
                .Should().ContainSingle().Which.Should().Be("Context: Context must be 1,600 characters or fewer.");
        }

        [Fact]
        public async Task Short_values_never_load_the_stored_document()
        {
            await _validator.ValidateAsync(new Glossary { ItemId = "g1", Name = "Workspace", Context = "short", AdditionalNote = "short" });

            _repository.Verify(r => r.GetStoredByIdAsync(It.IsAny<string>()), Times.Never);
        }
    }
}
