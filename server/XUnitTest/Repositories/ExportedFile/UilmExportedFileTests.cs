using BlocksTemplate.DomainService.Repositories;
using FluentAssertions;
using MongoDB.Bson.Serialization.Attributes;

namespace XUnitTest
{
    public class UilmExportedFileTests
    {
        [Fact]
        public void UilmExportedFile_CanSetAndGetAllProperties()
        {
            var createdAt = new DateTime(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc);

            var model = new UilmExportedFile
            {
                FileId = "file-1",
                FileName = "export-en-US.json",
                CreateDate = createdAt,
                CreatedBy = "user-1"
            };

            model.FileId.Should().Be("file-1");
            model.FileName.Should().Be("export-en-US.json");
            model.CreateDate.Should().Be(createdAt);
            model.CreatedBy.Should().Be("user-1");
        }

        [Fact]
        public void UilmExportedFile_HasExpectedBsonAttributes()
        {
            var type = typeof(UilmExportedFile);
            var fileIdProperty = type.GetProperty(nameof(UilmExportedFile.FileId));

            type.GetCustomAttributes(typeof(BsonIgnoreExtraElementsAttribute), inherit: false)
                .Should().ContainSingle();

            fileIdProperty.Should().NotBeNull();
            fileIdProperty!
                .GetCustomAttributes(typeof(BsonIdAttribute), inherit: false)
                .Should().ContainSingle();
        }
    }
}
