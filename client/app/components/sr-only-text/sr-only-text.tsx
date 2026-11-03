import { useT } from "@seliseblocks/genesis-os/i18n";

type SrOnlyTextProps = {
  textKey: "common:CLOSE" | "BREADCRUMB_ELLIPSIS.MORE";
};

/** Screen-reader-only label for the icon buttons inside the UI kit parts. */
export function SrOnlyText({ textKey }: Readonly<SrOnlyTextProps>) {
  const { t } = useT("localization.shared");
  return (
    <span className="sr-only">
      {textKey === "common:CLOSE" ? t("common:CLOSE") : t("BREADCRUMB_ELLIPSIS.MORE")}
    </span>
  );
}
