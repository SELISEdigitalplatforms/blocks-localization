import { useEffect, useMemo, type ReactNode } from "react";
import { useT } from "@seliseblocks/genesis-os/i18n";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Info, Plus, Trash } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { IBlocksLanguageKey } from "@blocks-localization/models/language";
import { useSaveBlocksLanguageKey } from "@blocks-localization/hooks/use-language-manager";

const COMMON_ERROR = "common:ERROR";

// Puts a styled node where the marker sits in a translated sentence.
const MARKER = "\u0001";
const withNode = (text: string, node: ReactNode) => {
  const [before = "", after = ""] = text.split(MARKER);
  return (
    <>
      {before}
      {node}
      {after}
    </>
  );
};

interface FormData {
  routes: string[];
}

interface EditRouteProps {
  keyDetails: IBlocksLanguageKey;
  isOpen: boolean;
  onClose: () => void;
}

function EditRoute({ keyDetails, isOpen, onClose }: Readonly<EditRouteProps>) {
  const { t } = useT("localization.modules");
  const { isPending, mutateAsync } = useSaveBlocksLanguageKey();
  const schema = z.object({
    routes: z.array(z.string()).refine((routes) => routes.some((route) => route.trim() !== ""), {
      message: t("EDIT_ROUTE.ROUTE_REQUIRED"),
    }),
  });

  const form = useForm<FormData>({
    defaultValues: {
      routes: keyDetails.routes || [""],
    },
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ routes: keyDetails.routes || [""] });
    }
  }, [isOpen, keyDetails.routes, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    // @ts-expect-error - react-hook-form + zod type inference issue
    name: "routes",
  });

  const routes = useWatch({
    control: form.control,
    name: "routes",
  });

  const hasValidRoute = useMemo(() => {
    return routes && routes.some((route) => route?.trim() !== "");
  }, [routes]);

  const hasEmptyRoute = useMemo(() => {
    return routes?.some((route) => !route?.trim()) ?? false;
  }, [routes]);

  const buildPayload = (routesToSave: string[]) => ({
    itemId: keyDetails.itemId,
    keyName: keyDetails.keyName,
    moduleId: keyDetails.moduleId,
    resources:
      keyDetails?.resources?.length && keyDetails?.resources?.length > 0
        ? keyDetails.resources
        : [],
    routes: routesToSave,
    glossaryIds: keyDetails.glossaryIds,
    isPartiallyTranslated: keyDetails.isPartiallyTranslated,
    context: keyDetails.context,
  });

  const addRoute = () => {
    if (hasEmptyRoute) return;
    append("");
  };

  const deleteRoute = async (index: number) => {
    remove(index);
    const updatedRoutes = form.getValues("routes").filter((_, i) => i !== index);
    const filteredRoutes = updatedRoutes.filter((route) => route.trim() !== "");

    try {
      const res = await mutateAsync(buildPayload(filteredRoutes));
      if (res?.success) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("EDIT_ROUTE.ROUTE_DELETED"),
        });
      } else {
        showErrorToast({
          title: t(COMMON_ERROR),
          errors: res?.errorMessage,
        });
      }
    } catch (error) {
      showErrorToast({
        title: t(COMMON_ERROR),
        errors: error,
      });
    }
  };

  async function handleSave() {
    const filteredRoutes = form.getValues("routes").filter((route) => route.trim() !== "");

    try {
      const res = await mutateAsync(buildPayload(filteredRoutes));
      if (res?.success) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("EDIT_ROUTE.ROUTES_UPDATED"),
        });
        onClose();
      } else {
        showErrorToast({
          title: t(COMMON_ERROR),
          errors: res?.errorMessage,
        });
      }
    } catch (error) {
      showErrorToast({
        title: t(COMMON_ERROR),
        errors: error,
      });
    }
  }
  return (
    <DialogContent className="rounded-lg sm:max-w-[520px]">
      <DialogHeader className="space-y-3">
        <DialogTitle className="text-left text-xl">{t("EDIT_ROUTE.TITLE")}</DialogTitle>
        <DialogDescription className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-left text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              {withNode(
                t("EDIT_ROUTE.ADD_AFTER_HOSTNAME", { hostname: MARKER }),
                <span className="font-semibold text-foreground">{t("EDIT_ROUTE.HOSTNAME_TOKEN")}</span>,
              )}
            </p>
            <p>
              {withNode(
                t("EDIT_ROUTE.USE_PLACEHOLDER", { placeholder: MARKER }),
                <span className="font-mono text-foreground">{`{{ dynamic_routing }}`}</span>,
              )}
            </p>
            <p className="text-[11px]">
              {t("EDIT_ROUTE.EXAMPLE")}{" "}
              {/* eslint-disable-next-line no-restricted-syntax -- route syntax example, typed as is; an i18n value would interpolate its {{ }} */}
              <span className="font-mono">release-note/{`{{ dynamic_routing }}`}</span>
            </p>
          </div>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-3">
          {fields.length === 0 ? (
            <button
              type="button"
              onClick={addRoute}
              disabled={isPending}
              className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 text-center hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="mb-2 rounded-full bg-muted p-3 group-hover:bg-primary/10">
                <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("EDIT_ROUTE.NO_ROUTES")}
              </p>
              <p className="text-xs text-muted-foreground">{t("EDIT_ROUTE.CLICK_TO_ADD")}</p>
            </button>
          ) : (
            <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="group relative rounded-lg border bg-card p-3 shadow-xs hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Input
                        id={`route-${index}`}
                        placeholder={t("EDIT_ROUTE.ROUTE_PLACEHOLDER")}
                        className="h-9 border-input bg-background shadow-none focus-visible:border-primary"
                        value={routes?.[index] ?? ""}
                        onChange={(e) => form.setValue(`routes.${index}`, e.target.value)}
                        disabled={isPending}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground opacity-0  hover:bg-destructive/10 hover:text-destructive disabled:opacity-100 group-hover:opacity-100"
                      onClick={() => deleteRoute(index)}
                      disabled={isPending}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {fields.length > 0 && (
          <Button
            variant="outline"
            className="w-full gap-2 border-dashed"
            onClick={addRoute}
            disabled={isPending || hasEmptyRoute}
          >
            <Plus className="h-4 w-4" />
            <span>{t("EDIT_ROUTE.ADD_ROUTE")}</span>
          </Button>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <DialogTrigger asChild>
          <Button variant="outline" size="default" className="flex-1 sm:flex-1">
            {t("common:CANCEL")}
          </Button>
        </DialogTrigger>
        <Button
          size="default"
          onClick={handleSave}
          disabled={isPending || !hasValidRoute}
          className="flex-1 sm:flex-1"
        >
          {isPending ? t("EDIT_ROUTE.UPDATING") : t("common:UPDATE")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default EditRoute;
