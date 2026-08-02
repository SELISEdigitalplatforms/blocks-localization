using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Entities;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Moq;
using Xunit;
using XUnitTest.Shared;

namespace XUnitTest.Repositories
{
    /// <summary>
    /// GetAllKeysAsync builds its Mongo filter from the request before it touches the
    /// collection, and that filter is where the whole keys grid is expressed: text search,
    /// per-culture resource search, module scoping, two date ranges and the missing-language
    /// rule. None of it was exercised, so a filter that silently matched everything or nothing
    /// would have looked healthy.
    /// </summary>
    public class KeyRepositoryGetAllKeysTests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider = new();
        private readonly Mock<IMongoDatabase> _database = new();
        private readonly Mock<IMongoCollection<Key>> _keyCollection = new();
        private readonly KeyRepository _repo;

        private FilterDefinition<Key>? _capturedFilter;

        public KeyRepositoryGetAllKeysTests()
        {
            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database
                .Setup(x => x.GetCollection<Key>(It.IsAny<string>(), null))
                .Returns(_keyCollection.Object);

            MockCursorHelper.SetupFindAsync(_keyCollection, new List<Key>());
            _keyCollection
                .Setup(x => x.CountDocumentsAsync(
                    It.IsAny<FilterDefinition<Key>>(),
                    It.IsAny<CountOptions>(),
                    It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<Key>, CountOptions, CancellationToken>(
                    (f, _, _) => _capturedFilter = f)
                .ReturnsAsync(0L);

            _repo = new KeyRepository(_dbContextProvider.Object);
        }

        /// <summary>
        /// Renders the filter the repository actually handed to Mongo, so assertions are made
        /// against the query rather than against a mock having been called.
        /// </summary>
        private string RenderedFilter()
        {
            _capturedFilter.Should().NotBeNull();
            return _capturedFilter!
                .Render(new RenderArgs<Key>(
                    BsonSerializer.SerializerRegistry.GetSerializer<Key>(),
                    BsonSerializer.SerializerRegistry))
                .ToString();
        }

        private static GetKeysRequest Request() => new() { PageNumber = 0, PageSize = 20 };

        [Fact]
        public async Task An_unfiltered_request_does_not_constrain_the_query()
        {
            await _repo.GetAllKeysAsync(Request());

            RenderedFilter().Should().Be("{ }");
        }

        [Fact]
        public async Task Key_search_text_matches_the_key_name_or_any_resource_value()
        {
            var request = Request();
            request.KeySearchText = "greeting";

            await _repo.GetAllKeysAsync(request);

            var rendered = RenderedFilter();
            rendered.Should().Contain("$or");
            rendered.Should().Contain("KeyName");
            rendered.Should().Contain("Resources");
            rendered.Should().Contain("greeting");
        }

        [Fact]
        public async Task Key_search_text_is_escaped_so_a_regex_metacharacter_is_matched_literally()
        {
            // Without escaping, a user typing "a.b" would match "axb" and a stray "(" would
            // throw when Mongo compiled the pattern.
            var request = Request();
            request.KeySearchText = "a.b(";

            await _repo.GetAllKeysAsync(request);

            RenderedFilter().Should().Contain(@"a\\.b\\(");
        }

        [Fact]
        public async Task A_whitespace_only_search_is_ignored_rather_than_matching_everything()
        {
            var request = Request();
            request.KeySearchText = "   ";
            request.SearchKey = "   ";

            await _repo.GetAllKeysAsync(request);

            RenderedFilter().Should().Be("{ }");
        }

        [Fact]
        public async Task A_single_module_is_matched_by_equality()
        {
            var request = Request();
            request.ModuleIds = new[] { "mod-1" };

            await _repo.GetAllKeysAsync(request);

            RenderedFilter().Should().Contain("mod-1").And.NotContain("$in");
        }

        [Fact]
        public async Task Several_modules_are_matched_by_membership()
        {
            var request = Request();
            request.ModuleIds = new[] { "mod-1", "mod-2" };

            await _repo.GetAllKeysAsync(request);

            RenderedFilter().Should().Contain("$in").And.Contain("mod-2");
        }

        [Fact]
        public async Task An_empty_module_id_is_not_treated_as_a_module_to_match()
        {
            var request = Request();
            request.ModuleIds = new[] { "  " };

            await _repo.GetAllKeysAsync(request);

            RenderedFilter().Should().Be("{ }");
        }

        [Fact]
        public async Task A_resource_search_filter_pairs_the_culture_with_the_value()
        {
            // Culture and value have to travel together inside one ElemMatch, otherwise a key
            // matching the text in German would be returned for a French search.
            var request = Request();
            request.ResourceSearchFilters = new[]
            {
                new ResourceSearchFilter { Culture = "fr-FR", SearchText = "bonjour" }
            };

            await _repo.GetAllKeysAsync(request);

            var rendered = RenderedFilter();
            rendered.Should().Contain("$elemMatch");
            rendered.Should().Contain("fr-FR");
            rendered.Should().Contain("bonjour");
        }

        [Fact]
        public async Task A_resource_search_filter_missing_either_half_is_skipped()
        {
            var request = Request();
            request.ResourceSearchFilters = new[]
            {
                new ResourceSearchFilter { Culture = "fr-FR", SearchText = "" },
                new ResourceSearchFilter { Culture = "", SearchText = "bonjour" }
            };

            await _repo.GetAllKeysAsync(request);

            RenderedFilter().Should().Be("{ }");
        }

        [Fact]
        public async Task A_start_date_alone_becomes_an_open_ended_lower_bound()
        {
            var request = Request();
            request.LastUpdateDateRange = new DateRange { StartDate = new DateTime(2026, 1, 1) };

            await _repo.GetAllKeysAsync(request);

            var rendered = RenderedFilter();
            rendered.Should().Contain("LastUpdateDate").And.Contain("$gte");
            rendered.Should().NotContain("$lte");
        }

        [Fact]
        public async Task An_end_date_alone_becomes_an_open_ended_upper_bound()
        {
            var request = Request();
            request.LastUpdateDateRange = new DateRange { EndDate = new DateTime(2026, 6, 30) };

            await _repo.GetAllKeysAsync(request);

            var rendered = RenderedFilter();
            rendered.Should().Contain("LastUpdateDate").And.Contain("$lte");
            rendered.Should().NotContain("$gte");
        }

        [Fact]
        public async Task Both_dates_become_a_closed_interval()
        {
            var request = Request();
            request.LastUpdateDateRange = new DateRange
            {
                StartDate = new DateTime(2026, 1, 1),
                EndDate = new DateTime(2026, 6, 30)
            };

            await _repo.GetAllKeysAsync(request);

            var rendered = RenderedFilter();
            rendered.Should().Contain("$gte").And.Contain("$lte");
        }

        [Fact]
        public async Task An_empty_date_range_object_adds_no_constraint()
        {
            // The grid sends the range object whether or not the user picked dates, so the
            // empty case has to fall through rather than filtering on the default DateTime.
            var request = Request();
            request.LastUpdateDateRange = new DateRange();
            request.CreateDateRange = new DateRange();

            await _repo.GetAllKeysAsync(request);

            RenderedFilter().Should().Be("{ }");
        }

        [Fact]
        public async Task The_create_date_range_is_filtered_independently_of_the_update_range()
        {
            var request = Request();
            request.CreateDateRange = new DateRange { StartDate = new DateTime(2026, 2, 1) };

            await _repo.GetAllKeysAsync(request);

            var rendered = RenderedFilter();
            rendered.Should().Contain("$gte");
            rendered.Should().NotContain("LastUpdateDate");
        }

        [Fact]
        public async Task A_missing_language_matches_both_an_empty_resource_and_no_resource_at_all()
        {
            // "Missing" has two representations in the data, so covering only one of them
            // would quietly hide half the untranslated keys from the translator.
            var request = Request();
            request.MissingLanguages = new List<string> { "de-DE" };

            await _repo.GetAllKeysAsync(request);

            var rendered = RenderedFilter();
            rendered.Should().Contain("de-DE");
            rendered.Should().Contain("$or");
            rendered.Should().Contain("$not");
        }

        [Fact]
        public async Task Several_filters_are_combined_rather_than_replacing_one_another()
        {
            var request = Request();
            request.SearchKey = "welcome";
            request.ModuleIds = new[] { "mod-1" };
            request.LastUpdateDateRange = new DateRange { StartDate = new DateTime(2026, 1, 1) };

            await _repo.GetAllKeysAsync(request);

            var rendered = RenderedFilter();
            rendered.Should().Contain("welcome");
            rendered.Should().Contain("mod-1");
            rendered.Should().Contain("$gte");
        }

        [Fact]
        public async Task The_same_filter_drives_the_page_and_the_total_count()
        {
            // A count taken against a different filter than the page would give a pager that
            // promises rows the query cannot return.
            var request = Request();
            request.SearchKey = "welcome";

            await _repo.GetAllKeysAsync(request);

            _keyCollection.Verify(
                x => x.CountDocumentsAsync(
                    It.IsAny<FilterDefinition<Key>>(),
                    It.IsAny<CountOptions>(),
                    It.IsAny<CancellationToken>()),
                Times.Once);
            RenderedFilter().Should().Contain("welcome");
        }

        [Fact]
        public async Task The_response_carries_the_keys_and_the_total_together()
        {
            var keys = new List<Key> { new() { ItemId = "k1", KeyName = "welcome" } };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);
            _keyCollection
                .Setup(x => x.CountDocumentsAsync(
                    It.IsAny<FilterDefinition<Key>>(),
                    It.IsAny<CountOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(42L);

            var result = await _repo.GetAllKeysAsync(Request());

            result.Keys.Should().BeEquivalentTo(keys);
            result.TotalCount.Should().Be(42L);
        }
    }
}
