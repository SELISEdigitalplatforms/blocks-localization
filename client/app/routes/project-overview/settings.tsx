import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";

export default function ProjectSettingsPage() {
  return (
    <main className="flex flex-col">
      <div className="flex w-full flex-col">
        <div className="mb-6">
          <h3 className="text-2xl font-bold tracking-tight text-high-emphasis">Project Settings</h3>
          <p className="text-medium-emphasis mt-1">Configure your project settings</p>
        </div>
        <Card className="rounded shadow-none">
          <CardHeader>
            <CardTitle className="text-xl text-high-emphasis">Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-medium-emphasis">Project settings coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
