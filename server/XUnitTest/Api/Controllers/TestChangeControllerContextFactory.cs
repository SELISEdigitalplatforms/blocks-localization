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
        internal static ChangeControllerContext Create()
        {
            // Set up a BlocksContext so that BlocksContext.GetContext() doesn't return null
            var blocksContext = BlocksContext.Create(
                tenantId: "test-tenant",
                roles: Enumerable.Empty<string>(),
                userId: "test-user",
                isAuthenticated: true,
                requestUri: "https://localhost/test",
                organizationId: "test-org",
                expireOn: DateTime.UtcNow.AddHours(1),
                email: "test@test.com",
                permissions: Enumerable.Empty<string>(),
                userName: "test-user",
                phoneNumber: "",
                displayName: "Test User",
                refreshToken: "",
                oauthToken: "",
                actualTentId: "test-tenant");
            BlocksContext.SetContext(blocksContext, true);

            var tenantsMock = new Mock<ITenants>();
            tenantsMock.Setup(t => t.GetTenantByID(It.IsAny<string>()))
                .Returns(new Tenant
                {
                    TenantId = "test-tenant",
                    DbConnectionString = "mongodb://localhost:27017",
                    DBName = "test-db",
                    ApplicationDomain = "test.example.com",
                    JwtTokenParameters = new JwtTokenParameters
                    {
                        Issuer = "test-issuer",
                        Subject = "test-subject",
                        PrivateCertificatePassword = "test-password",
                        IssueDate = DateTime.UtcNow
                    }
                });
            tenantsMock.Setup(t => t.GetTenantDatabaseConnectionString(It.IsAny<string>()))
                .Returns(("mongodb://localhost:27017", "test-db"));

            var mongoDatabaseMock = new Mock<IMongoDatabase>();
            var mongoCollectionMock = new Mock<IMongoCollection<BsonDocument>>();

            // ChangeContext calls IDbContextProvider.GetCollection<BsonDocument>() and then
            // IMongoCollectionExtensions.Find() on it. We need to provide a real-enough collection.
            var asyncCursorMock = new Mock<IAsyncCursor<BsonDocument>>();
            asyncCursorMock.Setup(c => c.MoveNext(It.IsAny<CancellationToken>())).Returns(false);
            asyncCursorMock.Setup(c => c.MoveNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(false);
            asyncCursorMock.Setup(c => c.Current).Returns(new List<BsonDocument>());

            mongoCollectionMock.Setup(c => c.FindSync(
                It.IsAny<FilterDefinition<BsonDocument>>(),
                It.IsAny<FindOptions<BsonDocument, BsonDocument>>(),
                It.IsAny<CancellationToken>()))
                .Returns(asyncCursorMock.Object);

            var dbContextProviderMock = new Mock<IDbContextProvider>();
            dbContextProviderMock.Setup(d => d.GetDatabase(It.IsAny<string>()))
                .Returns(mongoDatabaseMock.Object);
            dbContextProviderMock.Setup(d => d.GetDatabase(It.IsAny<string>(), It.IsAny<string>()))
                .Returns(mongoDatabaseMock.Object);
            dbContextProviderMock.Setup(d => d.GetDatabase())
                .Returns(mongoDatabaseMock.Object);
            dbContextProviderMock.Setup(d => d.GetCollection<BsonDocument>(It.IsAny<string>()))
                .Returns(mongoCollectionMock.Object);
            dbContextProviderMock.Setup(d => d.GetCollection<BsonDocument>(It.IsAny<string>(), It.IsAny<string>()))
                .Returns(mongoCollectionMock.Object);

            var httpContext = new DefaultHttpContext();
            var httpContextAccessorMock = new Mock<IHttpContextAccessor>();
            httpContextAccessorMock.Setup(h => h.HttpContext).Returns(httpContext);

            return new ChangeControllerContext(
                tenantsMock.Object,
                dbContextProviderMock.Object,
                httpContextAccessorMock.Object);
        }
    }
}
