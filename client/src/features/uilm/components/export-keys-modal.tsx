import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { ModuleName } from "@/features/uilm/constants/modules.constants";
import {
  useGetPreSignedUrlForUpload,
  useUploadFileToBlob,
} from "@/features/uilm/hooks/use-storage-upload";
import {
  useUilmLanguageModules,
  useUilmLanguages,
  useUilmProjectKey,
  useUilmSaveLanguageKeyUilmExport,
} from "@/features/uilm/hooks/use-uilm-queries";
import { isErrorWithErrors } from "@/lib/error";
import { Button } from "@/platform/ui/components/button/button";
import { Checkbox } from "@/platform/ui/components/checkbox/checkbox";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/platform/ui/components/form/form";
import { Label } from "@/platform/ui/components/label/label";
import { RadioGroup, RadioGroupItem } from "@/platform/ui/components/radio-group/radio-group";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const outputTypes = [
  { id: 0, label: "Json" },
  { id: 3, label: "Xlsx" },
  { id: 4, label: "Csv" },
  { id: 5, label: "Xlf" },
] as const;

const FormSchema = z.object({
  items: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "You have to select at least one item.",
  }),
});

interface ExportKeysModalProps {
  onClose: () => void;
}

export function ExportKeysModal({ onClose }: ExportKeysModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const projectKey = useUilmProjectKey();
  const callerTenantId = useConsoleProjectStore((s) => s.selectedProject?.itemId ?? "");
  const { data: languageModules } = useUilmLanguageModules();
  const { data: availableLanguages } = useUilmLanguages();
  const { mutateAsync: exportAsync } = useUilmSaveLanguageKeyUilmExport();
  const { mutateAsync: getPresignedUrl } = useGetPreSignedUrlForUpload();
  const { mutateAsync: uploadFileMutate } = useUploadFileToBlob();

  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [selectedOutputType, setSelectedOutputType] = useState<number>(outputTypes[0].id);
  const [downloadChecked, setDownloadChecked] = useState(false);
  const [referenceFileId, setReferenceFileId] = useState<string>(() => uuidv4());
  const [xlfFile, setXlfFile] = useState<File | null>(null);
  const [isUploadingXlf, setIsUploadingXlf] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);

  const handleSelectFileType = () => {
    setCurrentStep(2);
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  const handleXlfFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlf") && !file.name.endsWith(".xliff")) {
      showErrorToast({ errors: "Please upload a valid XLF file." });
      return;
    }

    setXlfFile(file);
  };

  const handleRemoveXlfFile = () => {
    setXlfFile(null);
  };

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      items: [],
    },
  });

  const onSubmit = async () => {
    if (!projectKey) {
      showErrorToast({ errors: "Select a project in the console header." });
      return;
    }
    if (!callerTenantId) {
      showErrorToast({ errors: "Select a console project so export can be attributed." });
      return;
    }

    setIsUploadingXlf(true);
    try {
      let exportReferenceFileId = referenceFileId;

      if (selectedOutputType === 5 && xlfFile) {
        const res = await getPresignedUrl({
          itemId: "",
          accessModifier: "Public",
          configurationName: "Default",
          name: xlfFile.name,
          projectKey,
          tags: "",
          metaData: "",
          parentDirectoryId: "",
          moduleName: ModuleName.Localization,
        });

        if (!res.isSuccess) {
          throw new Error("Failed to get pre-signed URL");
        }

        const fileId = res.fileId;
        setReferenceFileId(fileId);
        await uploadFileMutate({ url: res.uploadUrl, file: xlfFile });
        exportReferenceFileId = fileId;
      }

      const payload = {
        outputType: selectedOutputType,
        messageCoRelationId: uuidv4(),
        appIds: selectedModuleIds,
        languages:
          selectedOutputType === 5
            ? selectedLanguages
            : availableLanguages
              ? availableLanguages.map((lang) => lang.languageCode)
              : ["en-US"],
        referenceFileId: exportReferenceFileId,
        callerTenantId,
        projectKey,
      };

      await exportAsync(payload);

      showSuccessToast({ description: "Successfully downloaded the export keys." });

      setCurrentStep(1);
      form.reset();
      setSelectedModuleIds([]);
      setDownloadChecked(false);
      setXlfFile(null);
      setSelectedLanguages([]);
      setReferenceFileId(uuidv4());
      onClose();
    } catch (error) {
      console.error("Error during export:", error);
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
        return;
      }
      showErrorToast({ errors: error instanceof Error ? error.message : "Export failed" });
    } finally {
      setIsUploadingXlf(false);
    }
  };

  const handleExport = () => {
    onSubmit();
  };

  useEffect(() => {
    setSelectedModuleIds(form.getValues("items") || []);
  }, [form.watch("items")]);

  return (
    <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden rounded-md sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle className="text-left">Export keys</DialogTitle>
        <DialogDescription className="!mt-[12px] text-sm text-medium-emphasis text-muted-foreground">
          Select the modules you'd like to export
        </DialogDescription>
      </DialogHeader>

      <div className="!mt-[8px] mb-8 flex-1 overflow-y-auto p-1 text-left text-high-emphasis">
        {currentStep === 1 && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="items"
                render={({ field }) => (
                  <FormItem>
                    <div className="mb-6">
                      {languageModules && languageModules.length > 0 ? (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              id="select-all"
                              checked={
                                field.value?.length === languageModules.length &&
                                languageModules.length > 0
                              }
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange(languageModules.map((item) => item.itemId));
                                } else {
                                  field.onChange([]);
                                }
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Select all</FormLabel>
                        </FormItem>
                      ) : (
                        <div className="text-sm text-muted-foreground">No module found.</div>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto pr-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                        {languageModules &&
                          languageModules.map((item) => (
                            <FormField
                              key={item.itemId}
                              control={form.control}
                              name="items"
                              render={({ field }) => (
                                <FormItem
                                  key={item.itemId}
                                  className="ml-3 flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(item.itemId)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          field.onChange([...field.value, item.itemId]);
                                        } else {
                                          field.onChange(
                                            field.value?.filter((value) => value !== item.itemId),
                                          );
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer">{item.moduleName}</FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        )}

        {currentStep === 2 && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4">
              <RadioGroup
                value={outputTypes.find((t) => t.id === selectedOutputType)?.label}
                onValueChange={(label) => {
                  const selected = outputTypes.find((type) => type.label === label);
                  if (selected) setSelectedOutputType(selected.id);
                }}
                className="space-y-4"
              >
                {outputTypes.map((type) => (
                  <div key={type.label} className="flex items-center space-x-2">
                    <RadioGroupItem value={type.label} id={type.label} />
                    <Label htmlFor={type.label} className="cursor-pointer">{type.label.toUpperCase()}</Label>
                  </div>
                ))}
              </RadioGroup>

              {/* XLF File Upload Section */}
              {selectedOutputType === 5 && (
                <div className="mt-4 space-y-2 rounded-md border border-border p-4 bg-muted/20">
                  <p className="text-sm font-medium text-foreground">Upload XLF File</p>
                  <p className="text-xs text-muted-foreground">
                    Please upload an XLF file to use as a template for export.
                  </p>
                  {!xlfFile ? (
                    <div className="mt-2">
                      <label
                        htmlFor="xlf-upload"
                        className="bg-background hover:bg-muted flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-3 text-sm transition-colors"
                      >
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Click to select XLF file</span>
                      </label>
                      <input
                        id="xlf-upload"
                        type="file"
                        accept=".xlf,.xliff"
                        className="hidden"
                        onChange={handleXlfFileChange}
                        disabled={isUploadingXlf}
                      />
                    </div>
                  ) : (
                    <div className="bg-background mt-2 flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4 text-primary" />
                        <span className="text-sm text-foreground">{xlfFile.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveXlfFile}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Language Selection Section for XLF */}
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-foreground">Select Languages</p>
                    <p className="text-xs text-muted-foreground">
                      Choose one or more languages to export.
                    </p>
                    {availableLanguages && availableLanguages.length > 0 ? (
                      <div className="mt-2 space-y-3">
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id="select-all-languages"
                            checked={
                              selectedLanguages.length === availableLanguages.length &&
                              availableLanguages.length > 0
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedLanguages(
                                  availableLanguages.map((lang) => lang.languageCode),
                                );
                              } else {
                                setSelectedLanguages([]);
                              }
                            }}
                          />
                          <Label htmlFor="select-all-languages" className="font-normal cursor-pointer">
                            Select all
                          </Label>
                        </div>
                        <div className="max-h-40 space-y-3 overflow-y-auto pl-6">
                          {availableLanguages.map((lang) => (
                            <div key={lang.itemId} className="flex items-start space-x-3">
                              <Checkbox
                                id={`lang-${lang.languageCode}`}
                                checked={selectedLanguages.includes(lang.languageCode)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedLanguages([
                                      ...selectedLanguages,
                                      lang.languageCode,
                                    ]);
                                  } else {
                                    setSelectedLanguages(
                                      selectedLanguages.filter(
                                        (code) => code !== lang.languageCode,
                                      ),
                                    );
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`lang-${lang.languageCode}`}
                                className="font-normal cursor-pointer"
                              >
                                {lang.languageName} ({lang.languageCode})
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-muted-foreground">No languages found.</div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-2 text-sm text-muted-foreground">
                How would you like to export?
              </div>
              <FormField
                control={form.control}
                name="items"
                render={() => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-2">
                    <FormControl>
                      <Checkbox
                        id="download"
                        checked={downloadChecked}
                        onCheckedChange={(checked) => setDownloadChecked(checked === true)}
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer m-0">Download</FormLabel>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        )}
      </div>

      <div className="mt-auto border-t pt-4 bg-background">
        {currentStep === 1 ? (
          <div className="flex flex-row-reverse gap-2">
            <Button
              size="sm"
              onClick={handleSelectFileType}
              disabled={selectedModuleIds.length === 0}
            >
              Select file type
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex justify-between items-center w-full">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <div className="space-x-2 flex">
              <Button size="sm" variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={
                  downloadChecked === false ||
                  (selectedOutputType === 5 && (!xlfFile || selectedLanguages.length === 0)) ||
                  isUploadingXlf
                }
              >
                {isUploadingXlf ? "Exporting..." : "Export"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );
}
