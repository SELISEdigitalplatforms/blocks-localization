using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using Moq;
using Xunit;

namespace XUnitTest.Services.Glossary
{
    public class GlossarySmallHelpersTests
    {
        [Theory]
        [InlineData(GlossaryRule.Translate, "translate")]
        [InlineData(GlossaryRule.Keep, "keep")]
        [InlineData(GlossaryRule.Forbidden, "forbidden")]
        public void Every_rule_has_its_wire_spelling(GlossaryRule rule, string wire)
        {
            GlossaryWireValues.ToWire(rule).Should().Be(wire);
            GlossaryWireValues.TryParseRule(wire, out var parsed).Should().BeTrue();
            parsed.Should().Be(rule);
        }

        [Theory]
        [InlineData(GlossaryStatus.Approved, "approved")]
        [InlineData(GlossaryStatus.Draft, "draft")]
        [InlineData(GlossaryStatus.Deprecated, "deprecated")]
        public void Every_status_has_its_wire_spelling(GlossaryStatus status, string wire)
        {
            GlossaryWireValues.ToWire(status).Should().Be(wire);
            GlossaryWireValues.TryParseStatus(wire, out var parsed).Should().BeTrue();
            parsed.Should().Be(status);
        }

        [Fact]
        public async Task A_change_without_previous_modules_triggers_a_plain_recheck()
        {
            var recheck = new Mock<IGlossaryRecheckService>();
            var cache = new Mock<IGlossaryMatcherCache>();

            await new GlossaryChangeNotifier(cache.Object, recheck.Object).NotifyAsync("t1", new[] { "g1" });

            cache.Verify(c => c.Invalidate("t1"), Times.Once);
            recheck.Verify(r => r.TriggerAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.SequenceEqual(new[] { "g1" }))), Times.Once);
            recheck.Verify(r => r.TriggerAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<bool>()), Times.Never);
        }
    }
}
