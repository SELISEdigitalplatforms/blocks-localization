import { Card, CardContent } from "@/platform/ui/components/card/card";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

export function AddProjectCard() {
  return (
    <Link to="/create-project" className="block">
      <Card className="flex h-[160px] cursor-pointer items-center justify-center rounded-sm border border-border bg-card shadow-none transition-shadow duration-200 hover:shadow-md md:py-4">
        <CardContent className="p-0 text-center">
          <div className="flex justify-center">
            <Plus className="text-primary" strokeWidth={2} size={50} />
          </div>
          <p className="mt-2 font-bold text-primary">Add Project</p>
        </CardContent>
      </Card>
    </Link>
  );
}
