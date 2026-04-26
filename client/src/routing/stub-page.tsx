import { Link } from "react-router-dom";
import { PageMeta } from "@/seo/page-meta";

export function StubPage({ title }: { title: string }) {
  return (
    <div className="thin-scrollbar flex h-full min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto overscroll-y-contain p-6">
      <PageMeta title={title} />
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-muted-foreground text-center text-sm">
        This route is not ported in UILM React yet. Use the full Next.js app for this flow.
      </p>
      <Link to="/console" className="text-primary text-sm">
        Back to console
      </Link>
    </div>
  );
}
