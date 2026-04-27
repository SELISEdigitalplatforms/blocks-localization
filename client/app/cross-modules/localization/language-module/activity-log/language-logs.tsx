import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import LocalizationTimeline from "../localization-timeline/localization-timeline";

export function LanguageLogs() {
  return (
    <div className="flex h-full w-full min-w-0 flex-col gap-5 p-6">
      <div className="hidden md:block">
        <PageBreadcrumb breadcrumbIndex={2} />
      </div>
      <LocalizationTimeline
        timelineQuery={{}}
        cardTitle="Activity log"
        cardDescription="Full audit trail of translation and key changes for this project."
      />
    </div>
  );
}
