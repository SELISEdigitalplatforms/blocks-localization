using Blocks.Genesis;
using Microsoft.AspNetCore.Http;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;

namespace XUnitTest
{
    internal static class TestChangeControllerContextFactory
    {
        /// <summary>
        /// Creates a real ChangeControllerContext with mocked dependencies so that the
        /// non-virtual ChangeContext method can execute without NullReferenceException.
        /// </summary>




        //    mongoCollectionMock.Setup(c => c.FindSync(
        //        It.IsAny<FilterDefinition<BsonDocument>>(),
        //        It.IsAny<FindOptions<BsonDocument, BsonDocument>>(),
        //        It.IsAny<CancellationToken>()))
        //        .Returns(asyncCursorMock.Object);



    }
}
