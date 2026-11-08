using Microsoft.Extensions.Logging;
using Moq;

namespace XUnitTest.Shared
{
    internal static class LoggerMockExtensions
    {
        /// <summary>Verifies one log entry at <paramref name="level"/> whose formatted message equals <paramref name="message"/>.</summary>
        public static void VerifyLog<T>(this Mock<T> logger, LogLevel level, string message, Func<Times>? times = null) where T : class, ILogger =>
            logger.Verify(x => x.Log(level, It.IsAny<EventId>(), It.Is<It.IsAnyType>((state, _) => state.ToString() == message),
                It.IsAny<Exception?>(), It.IsAny<Func<It.IsAnyType, Exception?, string>>()), times ?? Times.Once);

        /// <summary>Every formatted message logged so far.</summary>
        public static List<string> LoggedMessages<T>(this Mock<T> logger) where T : class, ILogger =>
            logger.Invocations
                .Where(i => i.Method.Name == nameof(ILogger.Log))
                .Select(i => i.Arguments[2]?.ToString() ?? "")
                .ToList();
    }
}
