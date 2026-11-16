namespace XUnitTest.Shared
{
    /// <summary>Tests that block thread-pool threads on purpose; xUnit runs this collection after the others, alone.</summary>
    [CollectionDefinition(Name, DisableParallelization = true)]
    public sealed class ThreadPoolSensitiveTests
    {
        public const string Name = "Thread-pool sensitive tests";
    }
}
