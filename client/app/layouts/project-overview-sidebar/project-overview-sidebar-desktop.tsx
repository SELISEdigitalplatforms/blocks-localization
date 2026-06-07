import { Fragment } from "react";
import { Settings, Users, BookMinus, Package } from "lucide-react";
import { DesktopMenuItem } from "@/components/menus/desktop-menu-item";
import { Menu } from "@/models/menu-models";

const projectOverviewMenuItems: Menu[] = [
  {
    id: "environments",
    type: "menu" as const,
    name: "Environments",
    path: "/project-overview/environments",
    icon: Package,
  },
  // {
  //   id: "people",
  //   type: "menu" as const,
  //   name: "People",
  //   path: "/project-overview/people",
  //   icon: Users,
  // },
  // {
  //   id: "repositories",
  //   type: "menu" as const,
  //   name: "Repositories",
  //   path: "/project-overview/repositories",
  //   icon: BookMinus,
  // },
  // {
  //   id: "settings",
  //   type: "menu" as const,
  //   name: "Project Settings",
  //   path: "/project-overview/settings",
  //   icon: Settings,
  // },
];

type ProjectOverviewSidebarDesktopProps = {
  isSidebarOpen: boolean
}

export const ProjectOverviewSidebarDesktop = ({
  isSidebarOpen,
}: ProjectOverviewSidebarDesktopProps) => {
  return (
    <div className="w-full flex-1">
      <nav className="grid w-full items-start gap-1 text-sm">
        {projectOverviewMenuItems.map((item) => (
          <Fragment key={item.id}>
            {item.type === "menu" && (
              <DesktopMenuItem menu={item} isSidebarOpen={isSidebarOpen} />
            )}
          </Fragment>
        ))}
      </nav>
    </div>
  )
}
