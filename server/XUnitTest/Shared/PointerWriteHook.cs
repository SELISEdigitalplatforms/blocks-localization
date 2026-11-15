using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Moq;

namespace XUnitTest.Shared
{
    /// <summary>
    /// The publisher's view of a real <see cref="IKeyRepository"/>, with hooks around each pointer write: lets a test read
    /// the manifest, run maintenance or stop the worker exactly inside a publish's pointer switch.
    /// </summary>
    internal static class PointerWriteHook
    {
        public static IKeyRepository Around(IKeyRepository real, Func<UilmFile, Task>? before = null, Func<UilmFile, Task>? after = null)
        {
            var keys = new Mock<IKeyRepository>(MockBehavior.Strict);
            keys.Setup(k => k.GetUilmFilesOfModuleAsync(It.IsAny<string>()))
                .Returns((string module) => real.GetUilmFilesOfModuleAsync(module));
            keys.Setup(k => k.ReplaceUilmFilePointerAsync(It.IsAny<UilmFile>())).Returns(async (UilmFile pointer) =>
            {
                if (before != null) await before(pointer);
                var write = await real.ReplaceUilmFilePointerAsync(pointer);
                if (after != null) await after(pointer);
                return write;
            });
            keys.Setup(k => k.DeleteUilmFileDuplicatesAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Returns((string module, string language, string keepId) => real.DeleteUilmFileDuplicatesAsync(module, language, keepId));
            keys.Setup(k => k.DeleteUilmFilesOfOtherLanguagesAsync(It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>()))
                .Returns((string module, IReadOnlyCollection<string> languages) => real.DeleteUilmFilesOfOtherLanguagesAsync(module, languages));
            return keys.Object;
        }
    }
}
