using ClosedXML.Excel;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Shared.Entities;
using Microsoft.Extensions.Logging;

namespace Eurolm.DomainService.Services
{
    public class XlsxOutputGeneratorService : OutputGenerator
    {
        private readonly ILogger<XlsxOutputGeneratorService> _logger;

        public XlsxOutputGeneratorService()
        {

        }
        public XlsxOutputGeneratorService(
            ILogger<XlsxOutputGeneratorService> logger)
        {
            _logger = logger;
        }

        public override Task<T> GenerateAsync<T>(List<BlocksLanguage> languageSettings, List<BlocksLanguageModule> applications,
            List<BlocksLanguageKey> resourceKeys, string defaultLanguage)
        {
            try
            {
                _logger.LogInformation("++ Started XlsxOutputGeneratorService: GenerateAsync(Stream outputStream)...");
                int row = 1, column = 1;

                var workbook = new XLWorkbook() { Author = "SELISE Digital Platforms" };

                IXLWorksheet worksheet = workbook.Worksheets.Add("Resources");
                worksheet.ColumnWidth = 40;

                //create all the required columns
                worksheet.Cell(row, column++).Value = "ItemId";
                worksheet.Cell(row, column++).Value = "ModuleId";
                worksheet.Cell(row, column++).Value = "Module";
                worksheet.Cell(row, column++).Value = "KeyName";

                // Use all language codes from BlocksLanguage collection
                IEnumerable<string> indentifiers = languageSettings
                    .Select(x => x.LanguageCode)
                    .Where(x => !string.IsNullOrEmpty(x))
                    .Distinct()
                    .OrderBy(x => x);

                HandleLanguagesColumnName(row, column, worksheet, indentifiers, defaultLanguage);

                row++;
                column = 1;

                AssignCellValues(ref row, ref column, worksheet, indentifiers, applications, resourceKeys, defaultLanguage);

                HideColumns(worksheet);

                return Task.FromResult((T)(object)workbook);
            }
            catch (Exception ex)
            {
                _logger.LogError("XlsxOutputGeneratorService: GenerateAsync(Stream outputStream) Error: {ExMessage}", ex.Message);
                return Task.FromResult((T)(object)null);
            }
        }

        private static void HideColumns(IXLWorksheet worksheet)
        {
            for (int i = 1; i <= 2; i++)
            {
                IXLColumn xlcol = worksheet.Column(i);
                xlcol.Hide();
            }

            worksheet.SheetView.FreezeRows(1);
        }

        private static void AssignCellValues(ref int row, ref int column, IXLWorksheet worksheet, IEnumerable<string> indentifiers, List<BlocksLanguageModule> applications, List<BlocksLanguageKey> resourceKeys, string defaultLanguage)
        {
            foreach (BlocksLanguageKey resourceKey in resourceKeys)
            {
                BlocksLanguageModule app = applications.FirstOrDefault(x => x.ItemId == resourceKey.ModuleId);

                worksheet.Cell(row, column++).Value = resourceKey.ItemId;
                worksheet.Cell(row, column++).Value = resourceKey.ModuleId;
                worksheet.Cell(row, column++).Value = app?.ModuleName;
                worksheet.Cell(row, column++).Value = resourceKey.KeyName;

                foreach (string language in indentifiers)
                {
                    Resource currentLanguageResource = resourceKey.Resources?.FirstOrDefault(resource => resource.Culture == language);
                    string resourceValue = currentLanguageResource == null ? "" : currentLanguageResource.Value;

                    worksheet.Cell(row, column++).Value = resourceValue;
                    if (language != defaultLanguage)
                    {
                        worksheet.Cell(row, column++).Value = currentLanguageResource?.CharacterLength;
                    }
                }
                column = 1;
                row++;
            }
        }

        private static void HandleLanguagesColumnName(int row, int column, IXLWorksheet worksheet, IEnumerable<string> indentifiers, string defaultLanguage)
        {
            foreach (string language in indentifiers)
            {
                worksheet.Cell(row, column++).Value = language;
                if (language != defaultLanguage)
                {
                    worksheet.Cell(row, column++).Value = language + "_CharacterLength";
                }
            }
        }
    }
}