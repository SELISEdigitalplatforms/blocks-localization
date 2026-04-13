using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Shared.Entities;
using Microsoft.Extensions.Logging;
using System.IO.Compression;
using System.Text;
using System.Xml.Linq;

namespace BlocksTemplate.DomainService.Services
{
    public class XlfOutputGeneratorService : OutputGenerator
    {
        private readonly ILogger<XlfOutputGeneratorService> _logger;

        public XlfOutputGeneratorService()
        {
        }

        public XlfOutputGeneratorService(ILogger<XlfOutputGeneratorService> logger)
        {
            _logger = logger;
        }

        public override Task<T> GenerateAsync<T>(List<BlocksLanguage> languageSettings, List<BlocksLanguageModule> applications,
            List<BlocksLanguageKey> resourceKeys, string defaultLanguage)
        {
            return GenerateAsync<T>(languageSettings, applications, resourceKeys, defaultLanguage, null);
        }

        public override Task<T> GenerateAsync<T>(List<BlocksLanguage> languageSettings, List<BlocksLanguageModule> applications,
            List<BlocksLanguageKey> resourceKeys, string defaultLanguage, Dictionary<string, Dictionary<string, string>> referenceTranslations)
        {
            try
            {
                _logger?.LogInformation("++ Started XlfOutputGeneratorService: GenerateAsync()...");

                // Use all language codes from BlocksLanguage collection
                var identifiers = languageSettings
                    .Select(x => x.LanguageCode)
                    .Where(x => !string.IsNullOrEmpty(x))
                    .Distinct()
                    .OrderBy(x => x)
                    .ToList();

                // Remove default language from target languages (it will be the source)
                var targetLanguages = identifiers.Where(x => x != defaultLanguage).ToList();

                if (!targetLanguages.Any())
                {
                    _logger?.LogWarning("No target languages found for XLF export");
                    return Task.FromResult((T)(object)null);
                }

                XNamespace ns = "urn:oasis:names:tc:xliff:document:1.2";

                // Create a ZIP archive containing separate XLF files for each language
                var zipStream = new MemoryStream();

                using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Create, true))
                {
                    // Group resource keys by module
                    var groupedByModule = resourceKeys.GroupBy(x => x.ModuleId);

                    // Create one XLF file per target language
                    foreach (var targetLanguage in targetLanguages)
                    {
                        _logger?.LogInformation("Generating XLF file for language: {TargetLanguage}", targetLanguage);

                        // Create root XLIFF element for this language
                        var xliff = new XElement(ns + "xliff",
                            new XAttribute("version", "1.2"),
                            new XAttribute(XNamespace.Xmlns + "xsi", "http://www.w3.org/2001/XMLSchema-instance")
                        );

                        // Add file elements for each module
                        foreach (var moduleGroup in groupedByModule)
                        {
                            var module = applications.FirstOrDefault(x => x.ItemId == moduleGroup.Key);
                            var moduleName = module?.ModuleName ?? "Unknown";

                            // Get reference translations for this language if available
                            Dictionary<string, string> languageReferenceTranslations = null;
                            if (referenceTranslations != null && referenceTranslations.ContainsKey(targetLanguage))
                            {
                                languageReferenceTranslations = referenceTranslations[targetLanguage];
                            }

                            var fileElement = CreateFileElement(ns, defaultLanguage, targetLanguage, moduleName, moduleGroup.ToList(), languageReferenceTranslations);
                            xliff.Add(fileElement);
                        }

                        // Create XML document
                        var document = new XDocument(
                            new XDeclaration("1.0", "utf-8", null),
                            xliff
                        );

                        // Create entry in ZIP for this language
                        var entryName = $"{targetLanguage}.xlf";
                        var zipEntry = archive.CreateEntry(entryName, CompressionLevel.Optimal);

                        using (var entryStream = zipEntry.Open())
                        using (var writer = new StreamWriter(entryStream, new UTF8Encoding(false)))
                        {
                            document.Save(writer, SaveOptions.None);
                        }

                        _logger?.LogInformation("Added {EntryName} to ZIP archive", entryName);
                    }
                }

                zipStream.Position = 0;

                _logger?.LogInformation("++ XlfOutputGeneratorService: GenerateAsync() completed successfully with {Count} language files", targetLanguages.Count);

                return Task.FromResult((T)(object)zipStream);
            }
            catch (Exception ex)
            {
                _logger?.LogError("XlfOutputGeneratorService: GenerateAsync() Error: {ExMessage}", ex.Message);
                return Task.FromResult((T)(object)null);
            }
        }

        private XElement CreateFileElement(XNamespace ns, string sourceLanguage, string targetLanguage,
            string moduleName, List<BlocksLanguageKey> resourceKeys, Dictionary<string, string>? referenceTranslations)
        {
            var fileElement = new XElement(ns + "file",
                new XAttribute("source-language", sourceLanguage),
                new XAttribute("target-language", targetLanguage),
                new XAttribute("datatype", "plaintext"),
                new XAttribute("original", moduleName),
                new XAttribute("product-name", "UILM")
            );

            // Add header
            var header = new XElement(ns + "header",
                new XElement(ns + "note", "Exported from UILM Localization System"),
                new XElement(ns + "note", $"Module: {moduleName}"),
                new XElement(ns + "note", $"Target Language: {targetLanguage}"),
                new XElement(ns + "note", $"Export Date: {DateTime.UtcNow:yyyy-MM-ddTHH:mm:ssZ}")
            );
            fileElement.Add(header);

            // Add body with trans-units
            var body = new XElement(ns + "body");

            foreach (var resourceKey in resourceKeys)
            {
                var sourceResource = resourceKey.Resources?.FirstOrDefault(r => r.Culture == sourceLanguage);
                var targetResource = resourceKey.Resources?.FirstOrDefault(r => r.Culture == targetLanguage);

                // Skip if no source value
                if (sourceResource == null || string.IsNullOrEmpty(sourceResource.Value))
                    continue;

                var transUnitId = $"{resourceKey.ItemId}_{targetLanguage}";
                var transUnit = new XElement(ns + "trans-unit",
                    new XAttribute("id", transUnitId),
                    new XAttribute("resname", resourceKey.KeyName ?? "")
                );

                // Add source
                transUnit.Add(new XElement(ns + "source", sourceResource.Value));

                // Determine target value: prefer database value, then reference translation, then empty
                string? targetValue = null;
                string targetState = "needs-translation";

                if (targetResource != null && !string.IsNullOrEmpty(targetResource.Value))
                {
                    // Use value from database
                    targetValue = targetResource.Value;
                    targetState = resourceKey.IsPartiallyTranslated ? "needs-translation" : "translated";
                }
                else if (referenceTranslations != null &&
                         !string.IsNullOrEmpty(resourceKey.KeyName) &&
                         referenceTranslations.TryGetValue(resourceKey.KeyName, out var refTranslation) &&
                         !string.IsNullOrEmpty(refTranslation))
                {
                    // Use reference translation if no database value exists
                    targetValue = refTranslation;
                    targetState = "translated";
                    _logger?.LogInformation("Using reference translation for key: {KeyName} in language: {Language}", resourceKey.KeyName, targetLanguage);
                }

                // Add target element
                if (!string.IsNullOrEmpty(targetValue))
                {
                    var targetElement = new XElement(ns + "target", targetValue);
                    targetElement.Add(new XAttribute("state", targetState));
                    transUnit.Add(targetElement);
                }
                else
                {
                    // Empty target with needs-translation state
                    transUnit.Add(new XElement(ns + "target",
                        new XAttribute("state", "needs-translation"),
                        string.Empty));
                }

                // Add notes with metadata
                transUnit.Add(new XElement(ns + "note", $"Module: {moduleName}"));

                if (resourceKey.Routes != null && resourceKey.Routes.Any())
                {
                    transUnit.Add(new XElement(ns + "note", $"Routes: {string.Join(", ", resourceKey.Routes)}"));
                }

                if (targetResource != null && targetResource.CharacterLength > 0)
                {
                    transUnit.Add(new XElement(ns + "note", $"CharacterLength: {targetResource.CharacterLength}"));
                }

                // Add context if available
                if (!string.IsNullOrEmpty(resourceKey.Context))
                {
                    transUnit.Add(new XElement(ns + "note", $"Context: {resourceKey.Context}"));
                }

                body.Add(transUnit);
            }

            fileElement.Add(body);
            return fileElement;
        }
    }
}
