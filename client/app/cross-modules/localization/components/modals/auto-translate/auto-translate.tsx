import React, { useRef } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Label } from "@/components/ui-kits/label/label";
import { useGetLanguages, useTranslateAll } from "@blocks-localization/hooks/use-language-manager";
import { getDefaultLanguage } from "@blocks-localization/utils/glossary-rule-marker";
import { toast } from "@/hooks/use-toast";
import { getHttpErrorMessage } from "@/lib/error";
import { useT } from "@seliseblocks/genesis-os/i18n";

const AUTO_TRANSLATE_UNKNOWN_ERROR = "AUTO_TRANSLATE.UNKNOWN_ERROR";

interface AutoTranslateProps {
  onClose?: (value?: boolean) => void;
}

const AutoTranslate: React.FC<AutoTranslateProps> = ({ onClose }) => {
  const { t } = useT("localization.keys");
  const { isPending, mutateAsync } = useTranslateAll();
  const { data: languageListData } = useGetLanguages();
  const defaultLanguageCode = getDefaultLanguage(languageListData)?.languageCode ?? "";
  const runningRef = useRef(false);

  const formatErrorMessage = (errors: unknown): string => {
    if (errors === null || errors === undefined) return t(AUTO_TRANSLATE_UNKNOWN_ERROR);
    if (typeof errors === "string") return errors;
    if (typeof errors === "object") {
      const entries = Object.entries(errors);
      if (entries.length > 0) {
        return entries.map(([, value]) => String(value)).join("; ");
      }
      return t(AUTO_TRANSLATE_UNKNOWN_ERROR);
    }
    return t(AUTO_TRANSLATE_UNKNOWN_ERROR);
  };

  const handleTranslate = async () => {
    if (!defaultLanguageCode || runningRef.current) return;
    runningRef.current = true;

    const payload = {
      messageCoRelationId: "",
      defaultLanguage: defaultLanguageCode,
    };

    try {
      const res = await mutateAsync(payload);

      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("AUTO_TRANSLATE.PROCESSING_TITLE"),
          description: t("AUTO_TRANSLATE.PROCESSING_DESCRIPTION"),
        });
        onClose?.(false);
      } else {
        toast({
          variant: "destructive",
          title: t("common:ERROR"),
          description: formatErrorMessage(res?.errors),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("common:ERROR"),
        description: getHttpErrorMessage(error),
      });
    } finally {
      runningRef.current = false;
    }
  };

  return (
    <DialogContent
      onEscapeKeyDown={(event) => isPending && event.preventDefault()}
      onInteractOutside={(event) => isPending && event.preventDefault()}
    >
      <DialogHeader className="mb-4">
        <DialogTitle>{t("AUTO_TRANSLATE.TITLE")}</DialogTitle>
        <Label className="mt-[12px]! font-normal text-medium-emphasis">
          {t("AUTO_TRANSLATE.CONFIRM")}
        </Label>
      </DialogHeader>
      <DialogFooter className="mt-6">
        <DialogTrigger asChild>
          <Button disabled={isPending} variant="secondary" className="min-w-[80px]">
            {t("common:CANCEL")}
          </Button>
        </DialogTrigger>
        <Button
          disabled={isPending || !defaultLanguageCode}
          className="min-w-[80px]"
          onClick={() => void handleTranslate()}
        >
          {isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t("common:YES")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default AutoTranslate;
