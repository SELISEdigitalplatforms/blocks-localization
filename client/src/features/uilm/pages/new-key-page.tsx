import { LanguageSubpageChrome } from "@/features/uilm/components/language-subpage-chrome";
import { NewModuleModal } from "@/features/uilm/components/new-module-modal";
import {
  useUilmGetTranslationSuggestion,
  useUilmLanguageModules,
  useUilmLanguages,
  useUilmProjectKey,
  useUilmSaveLanguageKey,
} from "@/features/uilm/hooks/use-uilm-queries";
import { Button } from "@/platform/ui/components/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/platform/ui/components/card/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/platform/ui/components/command/command";
import { Dialog } from "@/platform/ui/components/dialog/dialog";
import { Input } from "@/platform/ui/components/input/input";
import { Label } from "@/platform/ui/components/label/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/platform/ui/components/popover/popover";
import { Textarea } from "@/platform/ui/components/textarea/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/platform/ui/components/tooltip/tooltip";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { cn } from "@/platform/ui/lib/cn";
import { Check, ChevronsUpDown, Info, Loader2, Plus, Trash, Wand } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

const NEW_KEY_FORM_ID = "uilm-new-key-form";

export function NewKeyPage() {
  const projectKey = useUilmProjectKey();
  const navigate = useNavigate();
  const { data: modules, isLoading: mLoading } = useUilmLanguageModules();
  const { data: languages, isLoading: lLoading } = useUilmLanguages();
  const safeModules = useMemo(
    () => (Array.isArray(modules) ? modules : []),
    [modules],
  );
  const save = useUilmSaveLanguageKey();
  const { mutateAsync: autoTranslateAsync } = useUilmGetTranslationSuggestion();

  const [keyName, setKeyName] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [values, setLangValue] = useState<Record<string, string>>({});
  const [routes, setRoutes] = useState<string[]>([]);
  const [modulePopoverOpen, setModulePopoverOpen] = useState(false);
  const [newModuleOpen, setNewModuleOpen] = useState(false);
  const [loadingTranslateIndex, setLoadingTranslateIndex] = useState<number | null>(null);

  const sortedLanguages = useMemo(() => {
    const list = Array.isArray(languages) ? [...languages] : [];
    list.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return 0;
    });
    return list;
  }, [languages]);

  const defaultLang = sortedLanguages[0];
  const defaultCode = defaultLang?.languageCode ?? "";

  useEffect(() => {
    if (!sortedLanguages.length) return;
    setLangValue((prev) => {
      const next = { ...prev };
      for (const l of sortedLanguages) {
        if (next[l.languageCode] === undefined) next[l.languageCode] = "";
      }
      return next;
    });
  }, [sortedLanguages]);

  const selectedModule = safeModules.find((m) => m.itemId === moduleId);
  const defaultValueText = values[defaultCode] ?? "";

  const isFormValid =
    keyName.trim().length >= 2 &&
    keyName.trim().length <= 100 &&
    Boolean(moduleId) &&
    defaultValueText.trim().length > 0 &&
    defaultValueText.length <= 199 &&
    sortedLanguages.every((l) => (values[l.languageCode] ?? "").length <= 199);

  if (!projectKey) {
    return (
      <LanguageSubpageChrome title="New key" description="Create a translation key for this project.">
        <Card>
          <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
            <p>No UILM project is configured.</p>
            <p>
              Pick a project in the console header, set{" "}
              <code className="rounded bg-muted px-1">NEXT_PUBLIC_UILM_PROJECT_KEY</code>, or{" "}
              <Link to="/services/language/configure" className="font-medium text-primary hover:underline">
                open Configure
              </Link>{" "}
              and enter the tenant id.
            </p>
          </CardContent>
        </Card>
      </LanguageSubpageChrome>
    );
  }

  if (mLoading || lLoading) {
    return (
      <LanguageSubpageChrome title="Create new key">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </LanguageSubpageChrome>
    );
  }

  const autoTranslateHandler =
    (
      destinationLanguageName: string | undefined,
      index: number,
    ): React.MouseEventHandler<HTMLButtonElement> =>
    async (e) => {
      e.preventDefault();
      const source = defaultValueText.trim();
      if (!source) return;
      setLoadingTranslateIndex(index);
      try {
        const res = await autoTranslateAsync({
          sourceText: source,
          destinationLanguage: destinationLanguageName || "English",
          currentLanguage: "English",
          temperature: 0.1,
          elementDetailContext: "",
        });
        if (res.content) {
          const lang = sortedLanguages[index + 1];
          if (lang) {
            setLangValue((s) => ({ ...s, [lang.languageCode]: res.content as string }));
          }
          showSuccessToast({ description: "Translated successfully" });
        } else {
          showErrorToast({ errors: JSON.stringify(res?.errors) });
        }
      } catch (error) {
        showErrorToast({
          errors: error instanceof Error ? error.message : JSON.stringify(error),
        });
      } finally {
        setLoadingTranslateIndex(null);
      }
    };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const kn = keyName.trim();
    if (kn.length < 2) {
      showErrorToast({ errors: "Key name must be at least 2 characters." });
      return;
    }
    if (kn.length > 100) {
      showErrorToast({ errors: "Key name must be 100 characters or less." });
      return;
    }
    if (!moduleId) {
      showErrorToast({ errors: "Select a module." });
      return;
    }
    if (!defaultCode) {
      showErrorToast({ errors: "No languages configured for this project." });
      return;
    }
    if (!defaultValueText.trim()) {
      showErrorToast({ errors: `Default language (${defaultCode}) value is required.` });
      return;
    }
    for (const l of sortedLanguages) {
      const v = values[l.languageCode] ?? "";
      if (v.length > 199) {
        showErrorToast({ errors: `Translation for ${l.languageName} must be less than 200 characters.` });
        return;
      }
    }

    const resources = sortedLanguages.map((l) => ({
      culture: l.languageCode,
      value: values[l.languageCode] ?? "",
    }));
    const partially = resources.some((r) => !r.value.trim());
    const routePayload = routes.map((r) => r.trim()).filter(Boolean);

    try {
      const res = await save.mutateAsync({
        itemId: uuidv4(),
        keyName: kn,
        moduleId,
        resources,
        routes: routePayload,
        isPartiallyTranslated: partially,
        projectKey,
        isNewKey: true,
        context: "",
      });
      if (!res.success) {
        showErrorToast({
          errors: res.validationErrors?.map((v) => v.errorMessage).join(", ") || res.errorMessage || "Save failed",
        });
        return;
      }
      showSuccessToast({ title: "Success", description: "Language key added" });
      navigate("/services/language", { replace: true });
    } catch (err) {
      showErrorToast({ errors: err instanceof Error ? err.message : "Save failed" });
    }
  };

  const appendRoute = () => setRoutes((r) => [...r, ""]);
  const updateRoute = (index: number, value: string) =>
    setRoutes((r) => r.map((x, i) => (i === index ? value : x)));
  const removeRoute = (index: number) => setRoutes((r) => r.filter((_, i) => i !== index));

  return (
    <LanguageSubpageChrome
      title="Create new key"
      actions={
        <Button type="submit" form={NEW_KEY_FORM_ID} disabled={save.isPending || !isFormValid}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      }
    >
      <form id={NEW_KEY_FORM_ID} onSubmit={onSubmit} className="space-y-4">
        <Card className="mt-2 rounded-sm border border-border shadow-none md:mt-6">
          <CardHeader>
            <CardTitle>About the key</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="nk-key-name">Key name</Label>
                  <Input
                    id="nk-key-name"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="Enter key name"
                    className="w-full shadow-none"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nk-module">Module</Label>
                  <Popover open={modulePopoverOpen} onOpenChange={setModulePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="nk-module"
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={modulePopoverOpen}
                        className={cn(
                          "h-[37px] w-full justify-between font-normal shadow-none",
                          selectedModule ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {selectedModule?.moduleName ?? "Select Module..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 sm:w-[475px]" align="start">
                      <Command>
                        <CommandInput placeholder="Search Module..." />
                        <CommandList>
                          <CommandEmpty>No Module found.</CommandEmpty>
                          <CommandGroup>
                            <button
                              type="button"
                              className="flex h-[37px] w-full cursor-pointer items-center gap-2 py-2 pl-8 pr-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                              onClick={() => {
                                setNewModuleOpen(true);
                                setModulePopoverOpen(false);
                              }}
                            >
                              <Plus className="h-5 w-5 shrink-0" />
                              <span>New Module</span>
                            </button>
                            <h3 className="py-2 pl-8 font-semibold text-foreground">Modules</h3>
                            {safeModules.map((module) => {
                              const moduleSearchValue = [module.moduleName, module.itemId]
                                .filter(Boolean)
                                .join(" ")
                                .toLowerCase();
                              return (
                                <CommandItem
                                  key={module.itemId}
                                  value={moduleSearchValue}
                                  onSelect={() => {
                                    setModuleId(module.itemId === moduleId ? "" : module.itemId);
                                    setModulePopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      moduleId === module.itemId ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  {module.moduleName}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="nk-default-value">
                  Default value ({defaultLang?.languageName ?? defaultCode})
                </Label>
                <Textarea
                  id="nk-default-value"
                  value={defaultValueText}
                  onChange={(e) =>
                    setLangValue((s) => ({
                      ...s,
                      [defaultCode]: e.target.value,
                    }))
                  }
                  placeholder="Enter default value"
                  className="min-h-20 shadow-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm border border-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Translations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {sortedLanguages.slice(1).map((lang, index) => (
                <div key={lang.itemId} className="grid gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Label className="self-center">{lang.languageName} Translation</Label>
                    <div className="flex justify-end gap-4">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1"
                        disabled={loadingTranslateIndex === index || !defaultValueText.trim()}
                        onClick={autoTranslateHandler(lang.languageName, index)}
                      >
                        <Wand className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                          {loadingTranslateIndex === index ? "Loading..." : "Auto-Translate"}
                        </span>
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Enter translation"
                    className="min-h-20 shadow-none"
                    value={values[lang.languageCode] ?? ""}
                    onChange={(e) =>
                      setLangValue((s) => ({
                        ...s,
                        [lang.languageCode]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm border border-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Routes</CardTitle>
            <div className="flex h-7 items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" className="p-0 hover:bg-background">
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="min-w-[400px] text-left" side="left" align="start">
                    <ul className="list-disc pl-5">
                      <li className="text-[12px]">
                        Add routes after <strong>hostname/</strong>
                      </li>
                      <li className="text-[12px]">
                        Replace dynamic parts of the route as <strong>{"{{ dynamic_routing }}"}</strong>
                      </li>
                      <div className="max-w-[380px] overflow-hidden text-ellipsis whitespace-normal">
                        <p className="text-[12px]">
                          For example, http://blocks.seliselocal.com/release-note/:id will be added as
                          release-note/<strong>{"{{ dynamic_routing }}"}</strong>
                        </p>
                      </div>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {routes.map((routeValue, index) => (
                <div key={`route-${index}`} className="flex items-end gap-2">
                  <div className="grid w-full gap-1.5">
                    <Label htmlFor={`nk-route-${index}`}>Route {index + 1}</Label>
                    <Input
                      id={`nk-route-${index}`}
                      type="text"
                      className="w-full shadow-none"
                      placeholder="Enter route"
                      value={routeValue}
                      onChange={(e) => updateRoute(index, e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRoute(index)}
                    aria-label="Remove Route"
                  >
                    <Trash className="h-6 w-6 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" className="w-[150px]" onClick={appendRoute}>
                <Plus className="h-5 w-5" />
                <span>Add Route</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Dialog open={newModuleOpen} onOpenChange={setNewModuleOpen}>
        {newModuleOpen ? <NewModuleModal onClose={setNewModuleOpen} /> : null}
      </Dialog>
    </LanguageSubpageChrome>
  );
}
