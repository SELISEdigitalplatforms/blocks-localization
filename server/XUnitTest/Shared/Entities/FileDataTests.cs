using Eurolm.DomainService.Shared.Entities;
using FluentAssertions;

namespace XUnitTest
{
    public class FileDataTests
    {
        [Fact]
        public void Properties_CanBeAssignedAndRead()
        {
            var metaData = new Dictionary<string, object>
            {
                ["size"] = 1024,
                ["mimeType"] = "application/json"
            };

            var fileData = new FileData
            {
                ItemId = "item-1",
                AccessModifier = 2,
                Url = "https://example.com/file.json",
                Name = "file.json",
                UploadUrl = "https://upload.example.com/file.json",
                MetaData = metaData
            };

            fileData.ItemId.Should().Be("item-1");
            fileData.AccessModifier.Should().Be(2);
            fileData.Url.Should().Be("https://example.com/file.json");
            fileData.Name.Should().Be("file.json");
            fileData.UploadUrl.Should().Be("https://upload.example.com/file.json");
            fileData.MetaData.Should().BeSameAs(metaData);
            fileData.MetaData.Should().ContainKey("size").WhoseValue.Should().Be(1024);
            fileData.MetaData.Should().ContainKey("mimeType").WhoseValue.Should().Be("application/json");
        }
    }
}
