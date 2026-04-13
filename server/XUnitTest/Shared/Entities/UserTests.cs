using BlocksTemplate.DomainService.Shared.Entities;
using FluentAssertions;

namespace BlocksTemplate.XUnitTest
{
    public class UserTests
    {
        [Fact]
        public void Properties_CanBeAssignedAndRead()
        {
            var user = new User
            {
                ItemId = "user-1",
                FirstName = "John",
                LastName = "Doe",
                Email = "john.doe@example.com"
            };

            user.ItemId.Should().Be("user-1");
            user.FirstName.Should().Be("John");
            user.LastName.Should().Be("Doe");
            user.Email.Should().Be("john.doe@example.com");
        }

        [Fact]
        public void OptionalProperties_CanBeNull()
        {
            var user = new User
            {
                ItemId = "user-2",
                FirstName = null,
                LastName = null,
                Email = null
            };

            user.ItemId.Should().Be("user-2");
            user.FirstName.Should().BeNull();
            user.LastName.Should().BeNull();
            user.Email.Should().BeNull();
        }
    }
}
