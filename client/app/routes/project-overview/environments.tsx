import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";

export default function ProjectEnvironmentsPage() {
  return (
    <main className="flex flex-col">
      <div className="flex w-full flex-col">
        <div className="mb-6">
          <h3 className="text-2xl font-bold tracking-tight text-[hsl(var(--high-emphasis))]">Environments</h3>
          <p className="text-[hsl(var(--medium-emphasis))] mt-1">Manage your project environments</p>
        </div>
        <Card className="rounded-xl border border-[hsl(var(--border-default))] shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-[hsl(var(--high-emphasis))]">Project Environments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[hsl(var(--medium-emphasis))]">Environment management coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
