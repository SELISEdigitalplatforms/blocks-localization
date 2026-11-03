import { useT } from "@seliseblocks/genesis-os/i18n";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import LocalizationTimeline from "../localization-timeline/localization-timeline";

const MODULE = "localization.tools";

export function LanguageLogs() {
  const { t } = useT(MODULE);
  return (
    <div className="flex h-full w-full min-w-0 flex-col gap-5 p-6">
      <div className="hidden md:block">
        <PageBreadcrumb breadcrumbIndex={2} />
      </div>
      <LocalizationTimeline
        timelineQuery={{}}
        cardTitle={t("LANGUAGE_LOGS.TITLE")}
        cardDescription={t("LANGUAGE_LOGS.DESCRIPTION")}
      />
    </div>
  );
}
