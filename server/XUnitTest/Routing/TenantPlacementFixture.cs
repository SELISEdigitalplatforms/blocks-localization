using System.Diagnostics;
using Blocks.Genesis;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;

namespace XUnitTest.Routing;

/// <summary>Isolated databases on local MongoDB; this does not validate independent deployed clusters.</summary>
internal sealed class TenantPlacementFixture : IDisposable
{
    private readonly ActivitySource _activity = new("TenantPlacementTests");
    private readonly string _prefix = "blocks_routing_" + Guid.NewGuid().ToString("N");
    public Mock<ITenants> Tenants { get; } = new(MockBehavior.Strict);
    public MongoDbContextProvider Provider { get; }
    public BlocksSecret Secret { get; }
    public IMongoDatabase Main => Provider.GetDatabase(Secret.DatabaseConnectionString, Secret.RootDatabaseName);
    public IMongoDatabase Dev => Provider.GetDatabase("dev");
    public IMongoDatabase Other => Provider.GetDatabase("other");

    public TenantPlacementFixture()
    {
        var portValue = Environment.GetEnvironmentVariable("BLOCKS_ROUTING_TEST_MONGO_PORT") ?? "27017";
        if (!int.TryParse(portValue, out var port) || port < 1 || port > 65535)
            throw new InvalidOperationException("BLOCKS_ROUTING_TEST_MONGO_PORT must be a valid local port.");
        Secret = new BlocksSecret
        {
            DatabaseConnectionString = $"mongodb://localhost:{port}/?appName=routing-main",
            DevDatabaseConnectionString = $"mongodb://localhost:{port}/?appName=routing-dev",
            OtherDatabaseConnectionString = $"mongodb://localhost:{port}/?appName=routing-other",
            RootDatabaseName = _prefix + "_main"
        };
        Tenants.Setup(t => t.GetTenantDatabaseConnectionString("root")).Returns((Secret.RootDatabaseName, Secret.DatabaseConnectionString));
        Tenants.Setup(t => t.GetTenantDatabaseConnectionString("dev")).Returns((_prefix + "_dev", Secret.DevDatabaseConnectionString));
        Tenants.Setup(t => t.GetTenantDatabaseConnectionString("other")).Returns((_prefix + "_other", Secret.OtherDatabaseConnectionString));
        Provider = new MongoDbContextProvider(NullLogger<MongoDbContextProvider>.Instance, Tenants.Object, _activity);
        // Fail visibly when the local integration prerequisite is absent.
        Main.RunCommand<BsonDocument>(new BsonDocument("ping", 1));
    }

    public void Dispose()
    {
        var client = new MongoClient(Secret.DatabaseConnectionString);
        foreach (var suffix in new[] { "_main", "_dev", "_other" })
            client.DropDatabase(_prefix + suffix);
        _activity.Dispose();
        BlocksContext.ClearContext();
    }
}
