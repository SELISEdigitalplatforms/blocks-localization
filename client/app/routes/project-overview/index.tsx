import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "@/store/useProjectStore";
import { Package } from "lucide-react";
import { motion } from "framer-motion";

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

  const quickActions = [
    {
      title: "Environments",
      description: "Manage project environments",
      icon: Package,
      path: "/project-overview/environments",
    },
    {
      title: "People",
      description: "Manage team members",
      icon: Package,
      path: "/project-overview/people",
    },
    {
      title: "Repositories",
      description: "Manage repositories",
      icon: Package,
      path: "/project-overview/repositories",
    },
    {
      title: "Settings",
      description: "Project settings",
      icon: Package,
      path: "/project-overview/settings",
    },
  ];

  return (
    <main className="flex flex-col">
      <div className="flex w-full flex-col">
        <div className="mb-6">
          <h3 className="text-2xl font-bold tracking-tight text-[hsl(var(--high-emphasis))]">
            {selectedProject.name}
          </h3>
          <p className="text-[hsl(var(--medium-emphasis))] mt-1">
            Select an option from the sidebar to manage your project
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: index * 0.06,
                duration: 0.35,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="group cursor-pointer rounded-xl border border-[hsl(var(--border-default))] bg-card p-6 shadow-sm hover:border-primary/40 hover:shadow-md"
              onClick={() => navigate(action.path)}
            >
              <action.icon className="mb-4 h-8 w-8 text-primary transition-transform duration-300 group-hover:scale-110" />
              <h4 className="font-semibold text-[hsl(var(--high-emphasis))]">
                {action.title}
              </h4>
              <p className="text-sm text-[hsl(var(--medium-emphasis))]">
                {action.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
