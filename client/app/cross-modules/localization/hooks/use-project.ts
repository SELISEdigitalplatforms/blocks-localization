import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { projectService } from "@/cross-modules/identifier/services/project.service";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { environmentOptions } from "@/constants/environment-options";

function shortGuidGenerator(length: number): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => letters[b % letters.length]).join("");
}

export const useGetProjects = (tenantGroupId = "") => {
  const { setProjects, selectedProject, setSelectedProject } =
    useProjectStore();

  const query = useQuery({
    queryKey: ["localization", "projects", tenantGroupId],
    queryFn: () => projectService.getProjects(0, 100, tenantGroupId),
    staleTime: 5 * 60 * 1000, // 5 minutes - prevent unnecessary refetches during navigation
  });

  useEffect(() => {
    if (!query.data) return;
    const flattenedProjects = query.data.flatMap((group) => group.projects);
    if (flattenedProjects.length > 0) {
      setProjects(flattenedProjects);
      if (!selectedProject) {
        setSelectedProject(flattenedProjects[0]);
      }
    }
  }, [query.data, selectedProject, setProjects, setSelectedProject]);

  return query;
};

export const useGetMigrationStatus = (tenantGroupId: string) => {
  return useQuery({
    queryKey: ["localization", "migration-status", tenantGroupId],
    queryFn: () => projectService.getMigrationStatus(tenantGroupId),
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["localization", "projects", "create"],
    mutationFn: (payload: {
      name: string;
      isAcceptBlocksTerms: boolean;
      isUseBlocksExclusively: boolean;
      isProduction: boolean;
      resources: { name: string; link: string; resourceId: string }[];
      applicationContexts: {
        environment: string;
        domain: string;
        cookieDomain: string;
      }[];
      tenantGroupId?: string;
    }) => projectService.createProject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["localization", "projects"] });
    },
  });
};

export const useAddProjectEnvironment = () => {
  const { isPending, mutateAsync } = useCreateProject();

  const addEnvironment = async ({
    selectedEnvironments,
    tenantGroupId,
    projectName,
    onClose,
  }: {
    selectedEnvironments: string[];
    tenantGroupId: string;
    projectName?: string;
    onClose?: (selectedEnvironments: string[]) => void | Promise<void>;
  }) => {
    if (selectedEnvironments.length === 0 || !tenantGroupId) return;

    const sortedSelected = [...selectedEnvironments].sort((a, b) => {
      const aIndex =
        environmentOptions.find((opt) => opt.value === a)?.index ?? 0;
      const bIndex =
        environmentOptions.find((opt) => opt.value === b)?.index ?? 0;
      return aIndex - bIndex;
    });

    const baseDomain = import.meta.env.BLOCKS_BASE_DOMAIN || "seliseblocks.com";
    const shortGuid = shortGuidGenerator(5);
    const applicationContexts = sortedSelected.map((env: string) => ({
      environment: env,
      domain: `https://${env === "main" ? "" : env}-${shortGuid}.${baseDomain}`,
      cookieDomain: baseDomain,
    }));

    try {
      await mutateAsync({
        name: projectName || "Project",
        isAcceptBlocksTerms: true,
        isUseBlocksExclusively: true,
        isProduction: false,
        resources: [],
        tenantGroupId: tenantGroupId,
        applicationContexts: applicationContexts,
      });

      showSuccessToast({ description: "Environment added successfully." });
      onClose?.(sortedSelected);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "errors" in error) {
        showErrorToast({ errors: (error as { errors: unknown }).errors });
      }
    }
  };

  return {
    isPending,
    addEnvironment,
  };
};

export const useProjectForm = () => {
  const navigate = useNavigate();
  const { isPending, mutateAsync } = useCreateProject();
  const { setTenantGroup, setSelectedProject } = useProjectStore();
  const queryClient = useQueryClient();

  const saveProject = async (formData: {
    name: string;
    isAcceptBlocksTerms: boolean;
    isUseBlocksExclusively: boolean;
    environments: { value: string }[];
    assets: { full_name: string; html_url: string; id?: number }[];
  }) => {
    try {
      const environments = formData.environments || [];
      const shortGuid = shortGuidGenerator(5);
      const baseDomain =
        import.meta.env.BLOCKS_BASE_DOMAIN || "seliseblocks.com";
      const applicationContexts =
        environments.map((env: { value: string }) => ({
          environment: env.value,
          domain: `https://${env.value === "main" ? "" : env.value}-${shortGuid}.${baseDomain}`,
          cookieDomain: baseDomain,
        })) || [];

      const assets = formData.assets || [];

      const response = await mutateAsync({
        name: formData.name,
        isAcceptBlocksTerms: formData.isAcceptBlocksTerms,
        isUseBlocksExclusively: formData.isUseBlocksExclusively,
        isProduction: false,
        resources: assets.map((asset) => ({
          name: asset.full_name,
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
            queryKey: ["localization", "projects", response.tenantGroupId],
            queryFn: () =>
              projectService.getProjects(0, 100, response.tenantGroupId),
            staleTime: 0,
          });

          if (
            projectGroups &&
            projectGroups.length > 0 &&
            projectGroups[0].projects &&
            projectGroups[0].projects.length > 0
          ) {
            setSelectedProject(projectGroups[0].projects[0]);
          }
        } catch {
          showErrorToast({ errors: response.errors });
        }

        navigate("/project-overview");
      } else {
        showErrorToast({ errors: response.errors });
      }
    } catch (error: unknown) {
      if (error && typeof error === "object" && "errors" in error) {
        showErrorToast({ errors: (error as { errors: unknown }).errors });
      }
    }
  };

  return {
    isPending,
    saveProject,
  };
};
