import { Button } from "@/components/ui-kits/button/button";
import { useGetGlossarySummaryCounts } from "@blocks-localization/hooks/use-language-manager";
import { GlossaryStatus } from "@blocks-localization/models/language";
import { GLOSSARY_STATUS_LABELS } from "@blocks-localization/components/glossary/glossary-status-badge";

interface GlossarySummaryStripProps {
  /** The list's Status filter; undefined = Total is active. */
  status: GlossaryStatus | undefined;
  onStatusChange: (status: GlossaryStatus | undefined) => void;
}

const SUMMARY_ORDER: readonly GlossaryStatus[] = ["approved", "draft", "deprecated"];

const formatCount = (count: number | undefined) =>
  typeof count === "number" ? count.toLocaleString() : "–";

const GlossarySummaryStrip = ({ status, onStatusChange }: Readonly<GlossarySummaryStripProps>) => {
  const counts = useGetGlossarySummaryCounts();
  return (
    <fieldset aria-label="Glossary summary" className="flex min-w-0 flex-wrap items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={status === undefined}
        className="aria-pressed:bg-muted aria-pressed:text-high-emphasis"
        onClick={() => onStatusChange(undefined)}
      >
        {formatCount(counts.total)} terms
      </Button>
      {SUMMARY_ORDER.map((bucket) => (
        <span key={bucket} className="flex items-center gap-1">
          <span aria-hidden="true" className="text-low-emphasis">
            ·
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={status === bucket}
            className="aria-pressed:bg-muted aria-pressed:text-high-emphasis"
            onClick={() => onStatusChange(bucket)}
          >
            {formatCount(counts[bucket])} {GLOSSARY_STATUS_LABELS[bucket].toLowerCase()}
          </Button>
        </span>
      ))}
    </fieldset>
  );
};

export default GlossarySummaryStrip;
