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
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";
import { toast } from "@/hooks/use-toast";
import { useProjectStore } from "@seliseblocks/blocks-kit";

const LoadingSkelton = () => (
  <div className="grid w-full gap-2">
    {Array.from({ length: 10 }).map((_, index) => (
      <Skeleton key={index} className="h-12 w-full rounded-lg" />
    ))}
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
  return "Failed to delete language. Please try again.";
};

const webhookSchema = z.object({
  url: z.string().url({ message: "Must be a valid URL" }),
  contentType: z.string().min(1, { message: "Content type is required" }),
  headerKey: z.string().min(1, { message: "Header key is required" }),
  secret: z.string().min(1, { message: "Secret is required" }),
  isDisabled: z.boolean(),
});

type WebhookFormValues = z.infer<typeof webhookSchema>;

function Configure() {
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
        toast({
          variant: "success",
          title: "Success",
          description: "Webhook saved successfully",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: JSON.stringify(res?.errorMessage),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: JSON.stringify(error),
      });
    }
  };

  const makeDefaultModalData = {
    dialogTitle: "Make default language",
    dialogSubtitle: "Are you sure you want to set this language as default?",
    confirmButton: "Save",
    cancelButton: "Cancel",
  };

  const deleteLanguageModalData = {
    dialogTitle: "Delete language",
    dialogSubtitle: "Are you sure you want to delete this language?",
    confirmButton: "Delete",
    cancelButton: "Cancel",
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
          title: "Success",
          description: "Deleted successfully",
        });
        setIsDeleteDialogOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: getDeleteLanguageErrorMessage(res?.errors),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
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
          title: "Success",
          description: "Make default successful",
        });
        setIsMakeDefaultDialogOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: JSON.stringify(res?.errors),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: JSON.stringify(error),
      });
    }
  };

  const columns: ColumnDef<ILanguageConfig>[] = [
    // {
    //   accessorKey: "itemId",
    //   header: () => {
    //     return (
    //       <div className="flex items-center">
    //         <span className="font-bold text-medium-emphasis">#</span>
    //       </div>
    //     );
    //   },
    //   cell: ({ row }) => {
    //     return (
    //       <div className="flex w-[120px] items-center">
    //         <span>{row.getValue("itemId")}</span>
    //       </div>
    //     );
    //   },
    // },
    {
      accessorKey: "languageName",
      header: () => {
        return (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Language</span>
          </div>
        );
      },
      cell: ({ row }) => {
        return (
          <div className="flex w-[150px] items-center">
            <span>{row.getValue("languageName")}</span>
            {row.original.isDefault && (
              <Badge color="bg-blocks-primary-500" className="ml-2 w-[100px] rounded-xl">
                Default
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "languageCode",
      header: () => {
        return (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Language Code</span>
          </div>
        );
      },
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
                <span>Make default language</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="cursor-pointer text-error"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteLanguageClick(row.getValue("languageName"));
                }}
              >
                <Trash className="mr-2 h-4 w-4" />
                <span>Delete language</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
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
        <h1 className="mt-5 text-2xl font-semibold">Configure Languages</h1>
        <Dialog open={isNewLanguageDialogOpen} onOpenChange={setIsNewLanguageDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="default"
              className="h-10 bg-primary text-sm text-primary-foreground"
            >
              <Plus className="mr-2 h-5 w-5" />
              <span className="sr-only sm:not-sr-only">New Language</span>
            </Button>
          </DialogTrigger>
          <NewLanguage
            onClose={setIsNewLanguageDialogOpen}
            existingLanguages={languageListData || []}
          />
        </Dialog>
      </div>
      <Card className="mt-6 rounded-sm border border-border shadow-none">
        <CardHeader>
          <CardTitle>Languages</CardTitle>
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
                    className="cursor-pointer font-normal text-medium-emphasis"
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
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6 rounded-sm border border-border shadow-none">
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
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
                      <FormLabel>URL</FormLabel>
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
                      <FormLabel>Content Type</FormLabel>
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
                      <FormLabel>Secret Header Key</FormLabel>
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
                      <FormLabel>Secret</FormLabel>
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
                      <FormLabel className="!mt-0">Disable webhook</FormLabel>
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
                  Save Webhook
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
