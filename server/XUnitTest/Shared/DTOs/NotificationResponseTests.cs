using BlocksTemplate.DomainService.Shared.DTOs;
using FluentAssertions;

namespace XUnitTest
{
    public class NotificationResponseTests
    {
        [Fact]
        public void Properties_CanBeAssignedAndRead()
        {
            var response = new NotificationResponse
            {
                errors = "none",
                isSuccess = true
            };

            response.errors.Should().Be("none");
            response.isSuccess.Should().BeTrue();
        }

        [Fact]
        public void DefaultValues_AreExpected()
        {
            var response = new NotificationResponse();

            response.errors.Should().BeNull();
            response.isSuccess.Should().BeFalse();
        }
    }
}
