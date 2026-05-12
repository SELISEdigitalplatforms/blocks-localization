import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";

export default function ProjectPeoplePage() {
  return (
    <main className="flex flex-col">
      <div className="flex w-full flex-col">
        <div className="mb-6">
          <h3 className="text-2xl font-bold tracking-tight text-high-emphasis">People</h3>
          <p className="text-medium-emphasis mt-1">Manage project team members and permissions</p>
        </div>
        <Card className="rounded shadow-none">
          <CardHeader>
            <CardTitle className="text-xl text-high-emphasis">Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-medium-emphasis">Team management coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
