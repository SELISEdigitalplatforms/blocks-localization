import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "@/store/useProjectStore";
import { Package } from "lucide-react";

export default function ProjectOverviewPage() {
  const navigate = useNavigate();
  const { selectedProject } = useProjectStore();

  useEffect(() => {
    if (!selectedProject) {
      navigate("/console", { replace: true });
    }
  }, [selectedProject, navigate]);

  if (!selectedProject) {
    return null;
  }

  return (
    <main className="flex flex-col">
      <div className="flex w-full flex-col">
        <div className="mb-6">
          <h3 className="text-2xl font-bold tracking-tight text-high-emphasis">
            {selectedProject.name}
          </h3>
          <p className="text-medium-emphasis mt-1">Select an option from the sidebar to manage your project</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div
            className="cursor-pointer rounded-sm border p-6 hover:border-primary transition-colors"
            onClick={() => navigate("/project-overview/environments")}
          >
            <Package className="mb-4 h-8 w-8 text-primary" />
            <h4 className="font-semibold">Environments</h4>
            <p className="text-sm text-medium-emphasis">Manage project environments</p>
          </div>
          <div
            className="cursor-pointer rounded-sm border p-6 hover:border-primary transition-colors"
            onClick={() => navigate("/project-overview/people")}
          >
            <Package className="mb-4 h-8 w-8 text-primary" />
            <h4 className="font-semibold">People</h4>
            <p className="text-sm text-medium-emphasis">Manage team members</p>
          </div>
          <div
            className="cursor-pointer rounded-sm border p-6 hover:border-primary transition-colors"
            onClick={() => navigate("/project-overview/repositories")}
          >
            <Package className="mb-4 h-8 w-8 text-primary" />
            <h4 className="font-semibold">Repositories</h4>
            <p className="text-sm text-medium-emphasis">Manage repositories</p>
          </div>
          <div
            className="cursor-pointer rounded-sm border p-6 hover:border-primary transition-colors"
            onClick={() => navigate("/project-overview/settings")}
          >
            <Package className="mb-4 h-8 w-8 text-primary" />
            <h4 className="font-semibold">Settings</h4>
            <p className="text-sm text-medium-emphasis">Project settings</p>
          </div>
        </div>
      </div>
    </main>
  );
}
