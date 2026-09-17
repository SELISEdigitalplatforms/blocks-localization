using DomainService.Storage;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using StorageDriver;

namespace Eurolm.DomainService.Services.HelperService
{
    public class StorageHelper
    {
        private readonly ILogger<StorageHelper> _logger;
        private readonly IStorageDriverService _storageDriverService;

        public StorageHelper(
            ILogger<StorageHelper> logger,
            IStorageDriverService storageDriverService)
        {
            _logger = logger;
            _storageDriverService = storageDriverService;
        }

        public async Task<bool> SaveIntoStorage(MemoryStream inputStream, string fileId, string fileName, Dictionary<string, object> metaData, string parentDirectoryId)
        {
            _logger.LogInformation("SaveIntoStorage: Saving file to storage -- fileId -- {FileId} -- fileName -- {FileName}", fileId, fileName);

            Stream stream = new MemoryStream();
            await stream.WriteAsync(inputStream.ToArray(), 0, inputStream.ToArray().Length);
            stream.Seek(0, SeekOrigin.Begin);

            var payload = new GetPreSignedUrlForUploadRequest
            {
                ItemId = fileId,
                MetaData = JsonConvert.SerializeObject(metaData),
                Name = fileName,
                ParentDirectoryId = parentDirectoryId,
                Tags = "[\"File\"]",
                AccessModifier = "Public",
            };
            var fileInfo = await _storageDriverService.GetPerSignedUrlForUploadAsync(payload);
            if (fileInfo == null || string.IsNullOrEmpty(fileInfo.UploadUrl))
            {
                _logger.LogError("SaveIntoStorage: Failed to get pre-signed URL for fileId={FileId}", fileId);
                return false;
            }

            _logger.LogInformation("SaveIntoStorage: Upload url - {Url}", fileInfo.UploadUrl);

            using var request = new HttpRequestMessage(HttpMethod.Put, fileInfo.UploadUrl)
            {
                Content = new StreamContent(stream)
            };
            AddAzureBlobHeaders(request);

            using var httpClient = new HttpClient();
            var httpResponseMessage = await httpClient.SendAsync(request);
            stream.Close();

            if (!httpResponseMessage.IsSuccessStatusCode)
            {
                return false;
            }

            if (!fileInfo.UploadCompletionRequired)
            {
                return true;
            }

            var completion = await _storageDriverService.CompleteUploadAsync(new CompleteUploadRequest
            {
                FileId = fileId,
                FileVersionId = fileInfo.FileVersionId,
            });

            if (completion?.VerificationStatus != Storage.DomainService.Enums.FileVerificationStatus.Verified)
            {
                _logger.LogError(
                    "SaveIntoStorage: Upload completion rejected fileId={FileId}, reason={RejectionReason}",
                    fileId, completion?.RejectionReason);
                return false;
            }

            return true;
        }

        public void AddAzureBlobHeaders(HttpRequestMessage httpRequestMessage)
        {
            try
            {
                httpRequestMessage.Headers.Add("x-ms-blob-type", "BlockBlob");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex.Message);
            }
        }
    }
}

