import { Button } from "@/components/ui-kits/button/button";
import { X } from "lucide-react";
import { MouseEventHandler } from "react";
import { useT } from "@seliseblocks/genesis-os/i18n";

type ResetButtonProps = {
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

export const ResetButton = ({ onClick, disabled = false }: ResetButtonProps) => {
  const { t } = useT("localization.shared");
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="h-8 px-2 lg:px-3"
      disabled={disabled}
    >
      {t("common:RESET")}
      <X className="ml-2 h-4 w-4" />
    </Button>
  );
};
