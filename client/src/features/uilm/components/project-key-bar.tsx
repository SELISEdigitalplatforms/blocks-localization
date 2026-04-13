import { useUilmProjectStore } from "@/features/uilm/state/uilm-project-store";
import { Button } from "@/platform/ui/components/button/button";
import { Input } from "@/platform/ui/components/input/input";
import { Label } from "@/platform/ui/components/label/label";
import { useEffect, useState } from "react";

export function ProjectKeyBar() {
  const stored = useUilmProjectStore((s) => s.projectKey);
  const setProjectKey = useUilmProjectStore((s) => s.setProjectKey);
  const [draft, setDraft] = useState(stored);

  useEffect(() => {
    setDraft(stored);
  }, [stored]);

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card p-3">
      <div className="min-w-[200px] flex-1 space-y-1">
        <Label htmlFor="uilm-project-key" className="text-xs text-muted-foreground">
          UILM project key
        </Label>
        <Input
          id="uilm-project-key"
          name="uilm-project-key"
          autoComplete="off"
          placeholder="Tenant / project id (same as monolith)"
          className="h-9 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
      <Button type="button" size="sm" onClick={() => setProjectKey(draft.trim())}>
        Apply
      </Button>
      {!stored ? (
        <p className="w-full text-xs text-muted-foreground">
          Usually set automatically when you pick a project in the console header. Optional env:{" "}
          <code className="rounded bg-muted px-1">NEXT_PUBLIC_UILM_PROJECT_KEY</code>.
        </p>
      ) : null}
    </div>
  );
}
