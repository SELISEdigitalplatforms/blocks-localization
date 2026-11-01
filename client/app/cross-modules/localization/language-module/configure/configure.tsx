import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Switch } from "@/components/ui-kits/switch/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import NewLanguage from "@blocks-localization/components/modals/new-language/new-language";
import {
  useDeleteLanguage,
  useGetLanguages,
  useGetWebhook,
  useSaveWebhook,
  useSetDefaultLanguage,
} from "@blocks-localization/hooks/use-language-manager";
import { ILanguageConfig, IWebhookConfig } from "@blocks-localization/models/language";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { EllipsisVertical, Plus, Star, Trash } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";
import { toast } from "@/hooks/use-toast";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { tStatic, useT } from "@seliseblocks/genesis-os/i18n";
import { cn } from "@/lib/utils";

const MODULE = "localization.tools";

const LanguageHeader = () => {
  const { t } = useT(MODULE);
  return (
    <div className="flex items-center">
      <span className="font-bold text-medium-emphasis">{t("CONFIGURE.LANGUAGE")}</span>
    </div>
  );
};

const LanguageCodeHeader = () => {
  const { t } = useT(MODULE);
  return (
    <div className="flex items-center">
      <span className="font-bold text-medium-emphasis">{t("CONFIGURE.LANGUAGE_CODE")}</span>
    </div>
  );
};

const ActionsHeader = () => {
  const { t } = useT(MODULE);
  return (
    <div className="flex items-center">
      <span className="font-bold text-medium-emphasis">{t("common:ACTIONS")}</span>
    </div>
  );
};

const SKELETON_LANGUAGE_ROW_KEYS = Array.from(
  { length: 5 },
  (_, rowNumber) => `language-row-skeleton-${rowNumber}`,
);

const WebhookFieldSkeleton = ({ className }: { className?: string }) => (
  <div className={cn("space-y-2", className)}>
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-10 w-full" />
  </div>
);

const LoadingSkelton = () => (
  <div data-testid="configure-loading-skeleton">
    <div className="flex items-end justify-between">
      <Skeleton className="mt-5 h-8 w-60" />
      <Skeleton className="h-10 w-10 sm:w-36" />
    </div>
    <Card className="mt-6 rounded-sm border border-border shadow-none">
      <CardHeader>
        <Skeleton className="h-5 w-28" />
      </CardHeader>
      <CardContent>
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="px-4 py-3 hover:bg-transparent">
              <TableHead>
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-28" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SKELETON_LANGUAGE_ROW_KEYS.map((rowKey) => (
              <TableRow key={rowKey}>
                <TableCell>
                  <div className="flex w-[150px] items-center">
                    <Skeleton className="h-4 w-24" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex w-[180px] items-center">
                    <Skeleton className="h-4 w-12" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    <Card className="mt-6 rounded-sm border border-border shadow-none">
      <CardHeader>
        <Skeleton className="h-5 w-28" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <WebhookFieldSkeleton className="sm:col-span-2" />
            <WebhookFieldSkeleton />
            <WebhookFieldSkeleton />
            <WebhookFieldSkeleton className="sm:col-span-2" />
            <div className="flex items-center gap-3 sm:col-span-2">
              <Skeleton className="h-6 w-11 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

const getDeleteLanguageErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (Array.isArray(error) && error.length > 0) return error.join(", ");
  if (error && typeof error === "object" && Object.keys(error).length > 0) {
    const messages = Object.values(error).filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    if (messages.length > 0) return messages.join(", ");
    return JSON.stringify(error);
  }
  return tStatic(MODULE, "CONFIGURE.DELETE_FAILED");
};

const isValidWebhookHostname = (hostname: string) => {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.includes(":");
  }

  const labels = hostname.split(".");
  return (
    labels.length >= 2 &&
    labels.every(
      (label) =>
        label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    )
  );
};

const isValidWebhookUrl = (value: string) => {
  if (!/^https?:\/\/\S+$/i.test(value)) return false;

  const authority = value.slice(value.indexOf("://") + 3).split(/[/?#]/, 1)[0];
  if (!authority || authority.endsWith(":")) return false;

  try {
    const url = new URL(value);
    return (
      isValidWebhookHostname(url.hostname) &&
      (url.protocol === "http:" || url.protocol === "https:")
    );
  } catch {
    return false;
  }
};

const buildWebhookSchema = (t: (key: string) => string) =>
  z.object({
    url: z
      .string()
      .trim()
      .min(1, { message: t("CONFIGURE.URL_REQUIRED") })
      .refine(isValidWebhookUrl, {
        message: t("CONFIGURE.URL_INVALID"),
      }),
    contentType: z.string().min(1, { message: t("CONFIGURE.CONTENT_TYPE_REQUIRED") }),
    headerKey: z.string().min(1, { message: t("CONFIGURE.HEADER_KEY_REQUIRED") }),
    secret: z.string().min(1, { message: t("CONFIGURE.SECRET_REQUIRED") }),
    isDisabled: z.boolean(),
  });

type WebhookFormValues = z.infer<ReturnType<typeof buildWebhookSchema>>;

function Configure() {
  const { t } = useT(MODULE);
  const [isNewLanguageDialogOpen, setIsNewLanguageDialogOpen] = useState(false);
  const [isMakeDefaultDialogOpen, setIsMakeDefaultDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLanguageData, setSelectedLanguageData] = useState<string | null>(null);
  const { isLoading: isLanguageListLoading, data: languageListData } = useGetLanguages();
  const { isPending: isDeleteLanguagePending, mutateAsync: deleteAsync } = useDeleteLanguage();
  const { isPending: isSetDefaultPending, mutateAsync: setDefaultAsync } = useSetDefaultLanguage();
  const { data: webhookData } = useGetWebhook();
  const { isPending: isSaveWebhookPending, mutateAsync: saveWebhookAsync } = useSaveWebhook();

  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  const webhookSchema = useMemo(() => buildWebhookSchema(t), [t]);

  const webhookForm = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      url: "",
      contentType: "application/json",
      headerKey: "",
      secret: "",
      isDisabled: false,
    },
    resetOptions: {
      keepDirtyValues: false,
    },
  });

  const isWebhookFormDirty = webhookForm.formState.isDirty;

  useEffect(() => {
    if (webhookData) {
      webhookForm.reset({
        url: webhookData.url,
        contentType: webhookData.contentType ?? "application/json",
        headerKey: webhookData.blocksWebhookSecret?.headerKey,
        secret: webhookData.blocksWebhookSecret?.secret,
        isDisabled: webhookData.isDisabled ?? false,
      });
    }
  }, [webhookData, webhookForm]);

  const onWebhookSubmit = async (values: WebhookFormValues) => {
    try {
      const payload: IWebhookConfig = {
        projectKey: tenantId,
        itemId: webhookData?.itemId,
        url: values.url,
        contentType: values.contentType,
        blocksWebhookSecret: {
          headerKey: values.headerKey,
          secret: values.secret,
        },
        isDisabled: values.isDisabled,
      };
      const res = await saveWebhookAsync(payload);
      if (res?.success) {
        webhookForm.reset(values);
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("CONFIGURE.WEBHOOK_SAVED"),
        });
      } else {
        toast({
          variant: "destructive",
          title: t("common:ERROR"),
          description: JSON.stringify(res?.errorMessage),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("common:ERROR"),
        description: JSON.stringify(error),
      });
    }
  };

  const makeDefaultModalData = {
    dialogTitle: t("CONFIGURE.MAKE_DEFAULT_TITLE"),
    dialogSubtitle: t("CONFIGURE.MAKE_DEFAULT_SUBTITLE"),
    confirmButton: t("common:SAVE"),
    cancelButton: t("common:CANCEL"),
  };

  const deleteLanguageModalData = {
    dialogTitle: t("CONFIGURE.DELETE_TITLE"),
    dialogSubtitle: t("CONFIGURE.DELETE_SUBTITLE"),
    confirmButton: t("common:DELETE"),
    cancelButton: t("common:CANCEL"),
  };

  const onMakeDefaultClick = (languageName: string) => {
    setIsMakeDefaultDialogOpen(true);
    setSelectedLanguageData(languageName);
  };

  const onDeleteLanguageClick = (languageName: string) => {
    setIsDeleteDialogOpen(true);
    setSelectedLanguageData(languageName);
  };

  const onConfirmDelete = async () => {
    try {
      const payload = {
        languageName: selectedLanguageData ?? "",
      };
      const res = await deleteAsync(payload);
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("CONFIGURE.LANGUAGE_DELETED"),
        });
        setIsDeleteDialogOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: t("common:ERROR"),
          description: getDeleteLanguageErrorMessage(res?.errors),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("common:ERROR"),
        description: getDeleteLanguageErrorMessage(error),
      });
    }
  };

  const onConfirmMakeDefault = async () => {
    try {
      const payload = {
        languageName: selectedLanguageData ?? "",
      };
      const res = await setDefaultAsync(payload);
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("CONFIGURE.DEFAULT_SET"),
        });
        setIsMakeDefaultDialogOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: t("common:ERROR"),
          description: JSON.stringify(res?.errors),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("common:ERROR"),
        description: JSON.stringify(error),
      });
    }
  };

  const columns: ColumnDef<ILanguageConfig>[] = [
    {
      accessorKey: "languageName",
      header: LanguageHeader,
      cell: ({ row }) => {
        return (
          <div className="flex w-[150px] items-center">
            <span>{row.getValue("languageName")}</span>
            {row.original.isDefault && (
              <Badge color="bg-blocks-primary-500" className="ml-2 w-[100px] rounded-xl">
                {t("CONFIGURE.DEFAULT_BADGE")}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "languageCode",
      header: LanguageCodeHeader,
      cell: ({ row }) => {
        return (
          <div className="flex w-[180px] items-center">
            <span>{row.getValue("languageCode")}</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      header: ActionsHeader,
      cell: ({ row }) => {
        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <EllipsisVertical width={20} height={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onMakeDefaultClick(row.getValue("languageName"));
                }}
              >
                <Star className="mr-2 h-4 w-4" />
                <span>{t("CONFIGURE.MAKE_DEFAULT_TITLE")}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="cursor-pointer text-error"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteLanguageClick(row.getValue("languageName"));
                }}
              >
                <Trash className="mr-2 h-4 w-4" />
                <span>{t("CONFIGURE.DELETE_TITLE")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table's useReactTable is the table API this component is built on.
  const table = useReactTable({
    data: languageListData || [],
    columns,
    enableRowSelection: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  if (isLanguageListLoading) return <LoadingSkelton />;

  return (
    <div>
      <div className="flex items-end justify-between">
        <h1 className="mt-5 text-2xl font-semibold">{t("CONFIGURE.PAGE_TITLE")}</h1>
        <Dialog open={isNewLanguageDialogOpen} onOpenChange={setIsNewLanguageDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="default"
              className="h-10 bg-primary text-sm text-primary-foreground"
            >
              <Plus className="mr-2 h-5 w-5" />
              <span className="sr-only sm:not-sr-only">{t("CONFIGURE.NEW_LANGUAGE")}</span>
            </Button>
          </DialogTrigger>
          {isNewLanguageDialogOpen && (
            <NewLanguage
              onClose={(val) => setIsNewLanguageDialogOpen(val ?? false)}
              existingLanguages={languageListData || []}
            />
          )}
        </Dialog>
      </div>
      <Card className="mt-6 rounded-sm border border-border shadow-none">
        <CardHeader>
          <CardTitle>{t("CONFIGURE.LANGUAGES_CARD")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="text-sm">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="px-4 py-3 hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} className="font-bold text-medium-emphasis">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="font-normal text-medium-emphasis"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    {t("CONFIGURE.NO_RESULTS")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6 rounded-sm border border-border shadow-none">
        <CardHeader>
          <CardTitle>{t("CONFIGURE.WEBHOOKS_CARD")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...webhookForm}>
            <form onSubmit={webhookForm.handleSubmit(onWebhookSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={webhookForm.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>
                        {t("CONFIGURE.URL_LABEL")} <span className="text-error">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/webhook" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={webhookForm.control}
                  name="contentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("CONFIGURE.CONTENT_TYPE_LABEL")} <span className="text-error">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="application/json" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={webhookForm.control}
                  name="headerKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("CONFIGURE.SECRET_HEADER_KEY_LABEL")}{" "}
                        <span className="text-error">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="X-Webhook-Secret" {...field} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={webhookForm.control}
                  name="secret"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>
                        {t("CONFIGURE.SECRET_LABEL")} <span className="text-error">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="********"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={webhookForm.control}
                  name="isDisabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 sm:col-span-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="mt-0!">{t("CONFIGURE.DISABLE_WEBHOOK")}</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  variant="default"
                  className="h-10 bg-primary text-sm text-primary-foreground"
                  disabled={isSaveWebhookPending || !isWebhookFormDirty}
                >
                  {t("CONFIGURE.SAVE_WEBHOOK")}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Dialog open={isMakeDefaultDialogOpen} onOpenChange={setIsMakeDefaultDialogOpen}>
        <ConfirmationModal
          onCancel={() => {}}
          onConfirm={onConfirmMakeDefault}
          data={makeDefaultModalData}
          buttonState={{ confirm: { disable: isSetDefaultPending } }}
        />
      </Dialog>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <ConfirmationModal
          onCancel={() => {}}
          onConfirm={onConfirmDelete}
          data={deleteLanguageModalData}
          buttonState={{ confirm: { disable: isDeleteLanguagePending } }}
        />
      </Dialog>
    </div>
  );
}

export { Configure };
