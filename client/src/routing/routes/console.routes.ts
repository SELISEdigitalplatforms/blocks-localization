import { ConsolePage } from "@/features/console/pages/console-page";
import { DataMigrationPage } from "@/features/console/pages/data-migration-page";
import { ProjectOverviewEnvironmentsPage } from "@/features/console/pages/project-overview-environments-page";
import { ProjectOverviewPeopleDetailPage } from "@/features/console/pages/project-overview-people-detail-page";
import { ProjectOverviewPeoplePage } from "@/features/console/pages/project-overview-people-page";
import { ProjectOverviewRepositoriesPage } from "@/features/console/pages/project-overview-repositories-page";
import { ProjectOverviewSettingsPage } from "@/features/console/pages/project-overview-settings-page";
import { CreateProjectPage } from "@/features/create-project/pages/create-project-page";
import { ProfilePage } from "@/features/profile/pages/profile-page";
import { ConsoleShellLayout } from "../../layouts/console-shell-layout";
import { ProjectOverviewShellLayout } from "../../layouts/project-overview-shell-layout";
import { createElement } from "react";
import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";

export const consoleRoutes: RouteObject[] = [
  {
    Component: ConsoleShellLayout,
    children: [
      { path: "console", Component: ConsolePage },
      { path: "profile", Component: ProfilePage },
      { path: "create-project", Component: CreateProjectPage },
      { path: "data-migration", Component: DataMigrationPage },
      {
        path: "project-overview",
        Component: ProjectOverviewShellLayout,
        children: [
          { index: true, element: createElement(Navigate, { to: "environments", replace: true }) },
          { path: "environments", Component: ProjectOverviewEnvironmentsPage },
          { path: "people/:userId", Component: ProjectOverviewPeopleDetailPage },
          { path: "people", Component: ProjectOverviewPeoplePage },
          { path: "repositories", Component: ProjectOverviewRepositoriesPage },
          { path: "settings", Component: ProjectOverviewSettingsPage },
        ],
      },
    ],
  },
];
