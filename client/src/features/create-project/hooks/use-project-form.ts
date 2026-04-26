import { env } from "@/config/env";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import {
  createIdentifierProject,
  fetchIdentifierProjects,
  getDefaultCookieDomain,
} from "@/features/console/services/identifier-project.service";
import { useCreateProjectFormStore, shortGuidGenerator } from "@/features/create-project/state/create-project-form-store";
import { useUilmProjectStore } from "@/features/uilm/state/uilm-project-store";
import { HttpError } from "@/platform/api/idp-http";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

export function useProjectForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { formData, resetFormData } = useCreateProjectFormStore();
  const setTenantGroup = useConsoleProjectStore((s) => s.setTennantGroup);
  const setSelectedProject = useConsoleProjectStore((s) => s.setSelectedProject);
  const setUilmProjectKey = useUilmProjectStore((s) => s.setProjectKey);

  const { isPending, mutateAsync } = useMutation({
    mutationKey: ["identifier", "projects", "create"],
    mutationFn: createIdentifierProject,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["identifier", "projects"] });
    },
  });

  const saveProject = async () => {
    try {
      const environments = formData[2]?.environments ?? [];
      const shortGuid = shortGuidGenerator(5);
      const cookieDomain = getDefaultCookieDomain();
      const applicationContexts = environments.map((envItem: { value: string }) => ({
        environment: envItem.value,
        domain: `https://${envItem.value === "main" ? "" : `${envItem.value}-`}${shortGuid}.${env.baseDomain}`,
        cookieDomain,
      }));

      const assets = formData[1]?.assets ?? [];
      const response = await mutateAsync({
        name: formData[0].name,
        isAcceptBlocksTerms: formData[0].isAcceptBlocksTerms,
        isUseBlocksExclusively: formData[0].isUseBlocksExclusively,
        isProduction: false,
        resources: assets.map((asset) => ({
          name: asset.full_name || asset.name,
          link: asset.html_url,
          resourceId: asset.id !== undefined ? String(asset.id) : "",
        })),
        applicationContexts,
      });

      if (response?.isSuccess) {
        showSuccessToast({ description: "Your project has been created." });
        setTenantGroup(response.tenantGroupId);

        try {
          const projectGroups = await queryClient.fetchQuery({
            queryKey: ["identifier", "projects", response.tenantGroupId],
            queryFn: () => fetchIdentifierProjects(0, 100, response.tenantGroupId),
            staleTime: 0,
          });

          const first =
            projectGroups?.[0]?.projects?.[0];
          if (first) {
            setSelectedProject(first);
            setUilmProjectKey(first.tenantId);
          }
        } catch {
          showErrorToast({ errors: response.errors });
        }

        resetFormData();
        navigate("/services/language", { replace: true });
      } else {
        showErrorToast({ errors: response.errors });
      }
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        showErrorToast({ errors: error.errors });
        return;
      }
      showErrorToast({ errors: error });
    }
  };

  return { isPending, saveProject };
}
