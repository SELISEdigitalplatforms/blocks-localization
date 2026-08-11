import { useEffect, useMemo } from "react";
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

const schema = z.object({
  routes: z.array(z.string()).refine((routes) => routes.some((route) => route.trim() !== ""), {
    message: "At least one route is required",
  }),
});

type FormData = z.infer<typeof schema>;

interface EditRouteProps {
  keyDetails: IBlocksLanguageKey;
  isOpen: boolean;
  onClose: () => void;
}

function EditRoute({ keyDetails, isOpen, onClose }: Readonly<EditRouteProps>) {
  const { isPending, mutateAsync } = useSaveBlocksLanguageKey();

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

  const addRoute = () => {
    if (hasEmptyRoute) return;
    append("");
  };

  const deleteRoute = async (index: number) => {
    remove(index);
    const updatedRoutes = form.getValues("routes").filter((_, i) => i !== index);
    const filteredRoutes = updatedRoutes.filter((route) => route.trim() !== "");

    try {
      const payload = {
        itemId: keyDetails.itemId,
        keyName: keyDetails.keyName,
        moduleId: keyDetails.moduleId,
        resources:
          keyDetails?.resources?.length && keyDetails?.resources?.length > 0
            ? keyDetails.resources
            : [],
        routes: filteredRoutes,
        glossaryIds: keyDetails.glossaryIds,
        isPartiallyTranslated: keyDetails.isPartiallyTranslated,
        context: keyDetails.context,
      };

      const res = await mutateAsync(payload);
      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: "Route deleted successfully",
        });
      } else {
        showErrorToast({
          title: "Error",
          errors: res?.errorMessage,
        });
      }
    } catch (error) {
      showErrorToast({
        title: "Error",
        errors: error,
      });
    }
  };

  async function handleSave() {
    const filteredRoutes = form.getValues("routes").filter((route) => route.trim() !== "");

    try {
      const payload = {
        itemId: keyDetails.itemId,
        keyName: keyDetails.keyName,
        moduleId: keyDetails.moduleId,
        resources:
          keyDetails?.resources?.length && keyDetails?.resources?.length > 0
            ? keyDetails.resources
            : [],
        routes: filteredRoutes,
        glossaryIds: keyDetails.glossaryIds,
        isPartiallyTranslated: keyDetails.isPartiallyTranslated,
        context: keyDetails.context,
      };

      const res = await mutateAsync(payload);
      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: "Routes updated successfully",
        });
        onClose();
      } else {
        showErrorToast({
          title: "Error",
          errors: res?.errorMessage,
        });
      }
    } catch (error) {
      showErrorToast({
        title: "Error",
        errors: error,
      });
    }
  }
  return (
    <DialogContent className="rounded-lg sm:max-w-[520px]">
      <DialogHeader className="space-y-3">
        <DialogTitle className="text-left text-xl">Edit Routes</DialogTitle>
        <DialogDescription className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-left text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              Add routes after <span className="font-semibold text-foreground">hostname/</span>
            </p>
            <p>
              Use <span className="font-mono text-foreground">{`{{ dynamic_routing }}`}</span> for
              dynamic segments
            </p>
            <p className="text-[11px]">
              Example: <span className="font-mono">release-note/{`{{ dynamic_routing }}`}</span>
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
              <p className="text-sm font-medium text-muted-foreground">No routes added yet</p>
              <p className="text-xs text-muted-foreground">Click here to add a route</p>
            </button>
          ) : (
            <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="group relative rounded-lg border bg-card p-3 shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Input
                        id={`route-${index}`}
                        placeholder="e.g., dashboard/settings"
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
            <span>Add Route</span>
          </Button>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <DialogTrigger asChild>
          <Button variant="outline" size="default" className="flex-1 sm:flex-1">
            Cancel
          </Button>
        </DialogTrigger>
        <Button
          size="default"
          onClick={handleSave}
          disabled={isPending || !hasValidRoute}
          className="flex-1 sm:flex-1"
        >
          {isPending ? "Saving..." : "Update"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default EditRoute;
