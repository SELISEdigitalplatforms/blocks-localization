using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared.Entities;
using DomainService.Storage;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using System.Net;
using Xunit;

namespace XUnitTest
{
    /// <summary>
    /// A minimal loopback HTTP server for tests exercising <see cref="StorageHelper.SaveIntoStorage"/>,
    /// which builds its own <see cref="HttpClient"/> internally rather than taking an injectable
    /// factory - so the only way to observe the PUT's outcome is to actually receive it.
    /// </summary>
    internal sealed class TestHttpServer : IDisposable
    {
        private readonly HttpListener _listener;
        private readonly Task _acceptLoop;

        public string Url { get; }

        public TestHttpServer(HttpStatusCode respondWith)
        {
            var port = GetFreeTcpPort();
            Url = $"http://127.0.0.1:{port}/upload";
            _listener = new HttpListener();
            _listener.Prefixes.Add($"http://127.0.0.1:{port}/");
            _listener.Start();

            _acceptLoop = Task.Run(async () =>
            {
                try
                {
                    var context = await _listener.GetContextAsync();
                    context.Response.StatusCode = (int)respondWith;
                    context.Response.Close();
                }
                catch (HttpListenerException)
                {
                    // Listener stopped while awaiting a request - fine, the test is tearing down.
                }
                catch (ObjectDisposedException)
                {
                    // Same as above.
                }
            });
        }

        private static int GetFreeTcpPort()
        {
            var listener = new System.Net.Sockets.TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            var port = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return port;
        }

        public void Dispose()
        {
            _listener.Stop();
            _listener.Close();
        }
    }

    public class StorageHelperTests
    {
        private readonly Mock<ILogger<StorageHelper>> _logger;
        private readonly Mock<IStorageDriverService> _storageDriverService;
        private readonly StorageHelper _service;

        public StorageHelperTests()
        {
            _logger = new Mock<ILogger<StorageHelper>>();
            _storageDriverService = new Mock<IStorageDriverService>();
            _service = new StorageHelper(_logger.Object, _storageDriverService.Object);
        }

        [Fact]
        public async Task SaveIntoStorage_CallsStorageDriverService()
        {
            // Arrange
            var inputStream = new MemoryStream();
            var testData = System.Text.Encoding.UTF8.GetBytes("test file content");
            inputStream.Write(testData, 0, testData.Length);
            inputStream.Seek(0, SeekOrigin.Begin);

            var fileId = "file-123";
            var fileName = "test.txt";
            var metaData = new Dictionary<string, object> { { "key", "value" } };
            var parentDirectoryId = "parent-456";

            var response = new GetPreSignedUrlForUploadResponse
            {
                UploadUrl = "https://storage.test/upload"
            };

            _storageDriverService
                .Setup(s => s.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync(response);

            // Act & Assert - this will fail due to HttpClient initialization in production code
            // but verifies the storage driver service is called
            try
            {
                await _service.SaveIntoStorage(inputStream, fileId, fileName, metaData, parentDirectoryId);
            }
            catch
            {
                // Expected to fail during HTTP request, but storage driver should have been called
            }

            _storageDriverService.Verify(s => s.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()), Times.Once);
        }

        [Fact]
        public async Task SaveIntoStorage_WhenStorageServiceReturnsNull_ReturnsFalseRatherThanThrowing()
        {
            // Arrange
            var inputStream = new MemoryStream();
            _storageDriverService
                .Setup(s => s.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync((GetPreSignedUrlForUploadResponse)null!);

            // Act
            var result = await _service.SaveIntoStorage(
                inputStream, "file-1", "test.txt", new Dictionary<string, object>(), "parent");

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public async Task SaveIntoStorage_UsesPrivateAccessModifier()
        {
            var inputStream = new MemoryStream();
            GetPreSignedUrlForUploadRequest? captured = null;
            _storageDriverService
                .Setup(s => s.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .Callback<GetPreSignedUrlForUploadRequest>(r => captured = r)
                .ReturnsAsync((GetPreSignedUrlForUploadResponse)null!);

            await _service.SaveIntoStorage(
                inputStream, "file-1", "test.txt", new Dictionary<string, object>(), "parent");

            captured!.AccessModifier.Should().Be("Private");
        }

        [Fact]
        public async Task SaveIntoStorage_SkipsCompletion_WhenNotRequired()
        {
            var inputStream = new MemoryStream();
            using var server = new TestHttpServer(HttpStatusCode.OK);
            _storageDriverService
                .Setup(s => s.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync(new GetPreSignedUrlForUploadResponse
                {
                    UploadUrl = server.Url,
                    UploadCompletionRequired = false,
                });

            var result = await _service.SaveIntoStorage(
                inputStream, "file-1", "test.txt", new Dictionary<string, object>(), "parent");

            result.Should().BeTrue();
            _storageDriverService.Verify(
                s => s.CompleteUploadAsync(It.IsAny<CompleteUploadRequest>()), Times.Never);
        }

        [Fact]
        public async Task SaveIntoStorage_CallsCompletion_AndSucceeds_WhenVerified()
        {
            var inputStream = new MemoryStream();
            using var server = new TestHttpServer(HttpStatusCode.OK);
            _storageDriverService
                .Setup(s => s.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync(new GetPreSignedUrlForUploadResponse
                {
                    UploadUrl = server.Url,
                    FileVersionId = "v1",
                    UploadCompletionRequired = true,
                });
            _storageDriverService
                .Setup(s => s.CompleteUploadAsync(It.Is<CompleteUploadRequest>(
                    r => r.FileId == "file-1" && r.FileVersionId == "v1")))
                .ReturnsAsync(new CompleteUploadResponse
                {
                    IsSuccess = true,
                    VerificationStatus = Storage.DomainService.Enums.FileVerificationStatus.Verified,
                });

            var result = await _service.SaveIntoStorage(
                inputStream, "file-1", "test.txt", new Dictionary<string, object>(), "parent");

            result.Should().BeTrue();
        }

        [Fact]
        public async Task SaveIntoStorage_ReturnsFalse_WhenCompletionRejects()
        {
            var inputStream = new MemoryStream();
            using var server = new TestHttpServer(HttpStatusCode.OK);
            _storageDriverService
                .Setup(s => s.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync(new GetPreSignedUrlForUploadResponse
                {
                    UploadUrl = server.Url,
                    FileVersionId = "v1",
                    UploadCompletionRequired = true,
                });
            _storageDriverService
                .Setup(s => s.CompleteUploadAsync(It.IsAny<CompleteUploadRequest>()))
                .ReturnsAsync(new CompleteUploadResponse
                {
                    IsSuccess = true,
                    VerificationStatus = Storage.DomainService.Enums.FileVerificationStatus.Rejected,
                    RejectionReason = "real_file_type_mismatch",
                });

            var result = await _service.SaveIntoStorage(
                inputStream, "file-1", "test.txt", new Dictionary<string, object>(), "parent");

            result.Should().BeFalse();
        }

        [Fact]
        public void AddAzureBlobHeaders_AddsCorrectHeader()
        {
            // Arrange
            var httpRequestMessage = new HttpRequestMessage(HttpMethod.Put, "https://test.blob.core.windows.net");

            // Act
            _service.AddAzureBlobHeaders(httpRequestMessage);

            // Assert
            httpRequestMessage.Headers.Contains("x-ms-blob-type").Should().BeTrue();
            httpRequestMessage.Headers.GetValues("x-ms-blob-type").First().Should().Be("BlockBlob");
        }

        [Fact]
        public void AddAzureBlobHeaders_WhenHeaderAlreadyExists_HandlesGracefully()
        {
            // Arrange
            var httpRequestMessage = new HttpRequestMessage(HttpMethod.Put, "https://test.blob.core.windows.net");
            httpRequestMessage.Headers.Add("x-ms-blob-type", "BlockBlob");

            // Act & Assert - should not throw
            var act = () => _service.AddAzureBlobHeaders(httpRequestMessage);
            act.Should().NotThrow();
        }
    }
}
