using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Shared.Entities;
using MongoDB.Driver;
using XUnitTest.Shared;

namespace XUnitTest.Routing;

public class MigrationPlacementTests : IDisposable
{
    private readonly TenantPlacementFixture _fixture = new();
    public void Dispose() => _fixture.Dispose();

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task CopyAndRetry_PreserveSource_TargetOwnership_AndOverwritePolicy(bool overwrite)
    {
        var repository = new EnvironmentDataMigrationRepository(_fixture.Provider);
        await _fixture.Dev.GetCollection<BlocksLanguageModule>("BlocksLanguageModules")
            .InsertOneAsync(new BlocksLanguageModule { ItemId = "module", ModuleName = "module", Name = "source", TenantId = "dev" });
        await _fixture.Other.GetCollection<BlocksLanguageModule>("BlocksLanguageModules")
            .InsertOneAsync(new BlocksLanguageModule { ItemId = "module", ModuleName = "module", Name = "existing", TenantId = "other" });
        await _fixture.Dev.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys")
            .InsertOneAsync(new BlocksLanguageKey { ItemId = "key", ModuleId = "module", KeyName = "key", Value = "source", TenantId = "dev" });
        await _fixture.Other.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys")
            .InsertOneAsync(new BlocksLanguageKey { ItemId = "key", ModuleId = "module", KeyName = "key", Value = "existing", TenantId = "other" });
        TestBlocksContext.Set("root");

        // Retry the same copy, as a worker can after a partial failure. The consumer assigns target ownership.
        for (var attempt = 0; attempt < 2; attempt++)
        {
            var modules = await repository.GetAllModulesAsync("dev");
            var keys = await repository.GetAllKeysAsync("dev");
            modules.ForEach(m => m.TenantId = "other");
            keys.ForEach(k => k.TenantId = "other");
            await repository.BulkUpsertModulesAsync(modules, "other", overwrite);
            await repository.BulkUpsertKeysAsync(keys, await repository.GetAllKeysAsync("other"), "other", overwrite);
            await repository.UpdateMigrationTrackerAsync("tracker", new ServiceMigrationStatus { IsCompleted = true });
        }

        Assert.Equal("source", Assert.Single(await repository.GetAllModulesAsync("dev")).Name);
        Assert.Equal("source", Assert.Single(await repository.GetAllKeysAsync("dev")).Value);
        var targetModule = Assert.Single(await repository.GetAllModulesAsync("other"));
        var targetKey = Assert.Single(await repository.GetAllKeysAsync("other"));
        Assert.Equal(overwrite ? "source" : "existing", targetModule.Name);
        Assert.Equal(overwrite ? "source" : "existing", targetKey.Value);
        Assert.Equal("other", targetModule.TenantId);
        Assert.Equal("other", targetKey.TenantId);
        Assert.Empty(await repository.GetAllKeysAsync("root"));
        Assert.Empty(await repository.GetAllModulesAsync("root"));
        Assert.True((await _fixture.Main.GetCollection<MigrationTracker>("MigrationTrackers").Find(t => t.ItemId == "tracker").SingleAsync()).LanguageService!.IsCompleted);
        Assert.Equal(0, await _fixture.Dev.GetCollection<MigrationTracker>("MigrationTrackers").CountDocumentsAsync(t => true));
        Assert.Equal(0, await _fixture.Other.GetCollection<MigrationTracker>("MigrationTrackers").CountDocumentsAsync(t => true));
    }

    [Fact]
    public async Task ConcurrentTrackerMessages_UseEachMessagesOwner()
    {
        var repository = new EnvironmentDataMigrationRepository(_fixture.Provider);
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task Update(string owner)
        {
            TestBlocksContext.Set(owner);
            await gate.Task;
            await repository.UpdateMigrationTrackerAsync("same-tracker", new ServiceMigrationStatus { QueueName = owner });
        }
        var dev = Update("dev");
        var other = Update("other");
        gate.SetResult();
        await Task.WhenAll(dev, other);
        foreach (var owner in new[] { "dev", "other" })
        {
            var tracker = await _fixture.Provider.GetDatabase(owner).GetCollection<MigrationTracker>("MigrationTrackers")
                .Find(t => t.ItemId == "same-tracker").SingleAsync();
            Assert.Equal(owner, tracker.LanguageService!.QueueName);
        }
        Assert.Equal(0, await _fixture.Main.GetCollection<MigrationTracker>("MigrationTrackers").CountDocumentsAsync(t => true));
    }

    [Fact]
    public async Task MissingTrackerOwner_FailsWithoutWritingToMain()
    {
        BlocksContext.ClearContext();
        var repository = new EnvironmentDataMigrationRepository(_fixture.Provider);
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.UpdateMigrationTrackerAsync("tracker", new ServiceMigrationStatus()));
        Assert.Equal(0, await _fixture.Main.GetCollection<MigrationTracker>("MigrationTrackers").CountDocumentsAsync(t => true));
    }
}
