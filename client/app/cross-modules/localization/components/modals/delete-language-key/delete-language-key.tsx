import React from "react";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { useProjectStore, useScopedPath } from "@seliseblocks/genesis-os";
import { useT } from "@seliseblocks/genesis-os/i18n";
import { useDeleteLanguageKey } from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { useLocation, useNavigate } from "react-router";

const COMMON_ERROR = "common:ERROR";

/**
 * The query string the Translations table had when it opened this key, so a delete returns to
 * the same filtered list. Only a "?..." string is trusted; other entry points carry no state.
 */
export const getReturnSearch = (state: unknown): string => {
  const returnSearch = (state as { returnSearch?: unknown } | null)?.returnSearch;
  return typeof returnSearch === "string" && returnSearch.startsWith("?") ? returnSearch : "";
};

interface DeleteLanguageKeyProps {
  itemId: string;
  onClose: () => void;
}

const DeleteLanguageKey: React.FC<DeleteLanguageKeyProps> = ({ itemId, onClose }) => {
  const { t } = useT("localization.keys");
  const navigate = useNavigate();
  const location = useLocation();
  const scoped = useScopedPath();
  const { isPending, mutateAsync } = useDeleteLanguageKey();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  const deleteKey = async () => {
    if (!tenantId || !itemId) {
      toast({
        variant: "destructive",
        title: t(COMMON_ERROR),
        description: t("DELETE_LANGUAGE_KEY.MISSING_IDENTIFIER"),
      });
      return;
    }
    try {
      const res = await mutateAsync({ itemId: itemId });

      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("DELETE_LANGUAGE_KEY.DELETED"),
        });
        navigate(scoped("services/language") + getReturnSearch(location.state), { replace: true });
        onClose();
      } else {
        const rawErrors = res?.errors;
        let errorMessage = t("DELETE_LANGUAGE_KEY.DELETE_FAILED");
        if (rawErrors && typeof rawErrors === "object") {
          if (Array.isArray(rawErrors) && rawErrors.length > 0) {
            errorMessage = (rawErrors as string[]).join(", ");
          } else if (!Array.isArray(rawErrors) && Object.keys(rawErrors).length > 0) {
            const firstError = Object.values(rawErrors)[0];
            errorMessage = typeof firstError === "string" ? firstError : JSON.stringify(rawErrors);
          }
        }
        toast({
          variant: "destructive",
          title: t(COMMON_ERROR),
          description: errorMessage,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t(COMMON_ERROR),
        description: error instanceof Error ? error.message : t("DELETE_LANGUAGE_KEY.UNEXPECTED_ERROR"),
      });
    }
  };

  return (
    <DialogContent className="rounded-md sm:max-w-[450px]">
      <DialogHeader>
        <DialogTitle className="text-left">{t("DELETE_LANGUAGE_KEY.TITLE")}</DialogTitle>
        <DialogDescription className="mt-4 text-left">
          <div>{t("DELETE_LANGUAGE_KEY.CONFIRM")}</div>
          <span className="opacity-0">{itemId}</span>
        </DialogDescription>
      </DialogHeader>

      <DialogFooter className="flex gap-2">
        <DialogTrigger>
          <Button variant="outline" size="default" className="w-full sm:w-auto" disabled={false}>
            {t("common:CANCEL")}
          </Button>
        </DialogTrigger>
        <Button size="default" className="bg-error" onClick={deleteKey} disabled={isPending}>
          {t("DELETE_LANGUAGE_KEY.TITLE")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
export default DeleteLanguageKey;
