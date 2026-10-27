using System;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Xunit;

namespace XUnitTest.Repositories
{
    /// <summary>
    /// The keyset filter a cursor continues from: rows strictly after the last row, including the
    /// null bucket MongoDB sorts first. MongoDB's evaluation of it is covered by the keyset
    /// integration tests; these pin its exact shape.
    /// </summary>
    public class KeyListCursorTests
    {
        private static readonly DateTime LastDate = new(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc);

        private static string AfterFilter(string sortField, bool isDescending, string? keyName)
        {
            var last = new Key { ItemId = "id-5", KeyName = keyName!, CreateDate = LastDate, LastUpdateDate = LastDate };
            var cursor = KeyListCursor.Decode(KeyListCursor.Encode(last, sortField, isDescending, "hash"));
            var registry = BsonSerializer.SerializerRegistry;
            return cursor.AfterFilter().Render(new RenderArgs<Key>(registry.GetSerializer<Key>(), registry)).ToString();
        }

        [Theory]
        [InlineData("KeyName", false, "welcome",
            "{ \"$or\" : [{ \"KeyName\" : { \"$gt\" : \"welcome\" } }, { \"KeyName\" : \"welcome\", \"_id\" : { \"$gt\" : \"id-5\" } }] }")]
        [InlineData("KeyName", true, "welcome",
            "{ \"$or\" : [{ \"KeyName\" : { \"$lt\" : \"welcome\" } }, { \"KeyName\" : \"welcome\", \"_id\" : { \"$lt\" : \"id-5\" } }, { \"KeyName\" : null }] }")]
        [InlineData("KeyName", false, null,
            "{ \"$or\" : [{ \"KeyName\" : null, \"_id\" : { \"$gt\" : \"id-5\" } }, { \"KeyName\" : { \"$ne\" : null } }] }")]
        [InlineData("KeyName", true, null,
            "{ \"KeyName\" : null, \"_id\" : { \"$lt\" : \"id-5\" } }")]
        [InlineData("CreateDate", false, "welcome",
            "{ \"$or\" : [{ \"CreateDate\" : { \"$gt\" : { \"$date\" : \"2026-01-02T03:04:05Z\" } } }, { \"CreateDate\" : { \"$date\" : \"2026-01-02T03:04:05Z\" }, \"_id\" : { \"$gt\" : \"id-5\" } }] }")]
        [InlineData("CreateDate", true, "welcome",
            "{ \"$or\" : [{ \"CreateDate\" : { \"$lt\" : { \"$date\" : \"2026-01-02T03:04:05Z\" } } }, { \"CreateDate\" : { \"$date\" : \"2026-01-02T03:04:05Z\" }, \"_id\" : { \"$lt\" : \"id-5\" } }, { \"CreateDate\" : null }] }")]
        [InlineData("LastUpdateDate", false, null,
            "{ \"$or\" : [{ \"LastUpdateDate\" : { \"$gt\" : { \"$date\" : \"2026-01-02T03:04:05Z\" } } }, { \"LastUpdateDate\" : { \"$date\" : \"2026-01-02T03:04:05Z\" }, \"_id\" : { \"$gt\" : \"id-5\" } }] }")]
        [InlineData("LastUpdateDate", true, null,
            "{ \"$or\" : [{ \"LastUpdateDate\" : { \"$lt\" : { \"$date\" : \"2026-01-02T03:04:05Z\" } } }, { \"LastUpdateDate\" : { \"$date\" : \"2026-01-02T03:04:05Z\" }, \"_id\" : { \"$lt\" : \"id-5\" } }, { \"LastUpdateDate\" : null }] }")]
        public void The_filter_continues_strictly_after_the_last_row(string sortField, bool isDescending, string? keyName, string expected)
        {
            AfterFilter(sortField, isDescending, keyName).Should().Be(expected);
        }
    }
}
