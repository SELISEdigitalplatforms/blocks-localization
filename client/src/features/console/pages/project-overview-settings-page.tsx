import { useIamCurrentUser } from "@/features/auth/hooks/use-iam-current-user";
import { formatProjectDateTime } from "@/features/console/lib/format-project-date";
import { useConsoleProjects } from "@/features/console/hooks/use-console-projects";
import { useUpdateTenantGroupMutation } from "@/features/console/hooks/use-project-overview-mutations";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { Button } from "@/platform/ui/components/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/platform/ui/components/card/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/platform/ui/components/form/form";
import { Input } from "@/platform/ui/components/input/input";
import { Label } from "@/platform/ui/components/label/label";
import { Skeleton } from "@/platform/ui/components/skeleton/skeleton";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { PageMeta } from "@/seo/page-meta";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const projectNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .min(3, "Project name must be at least 3 characters")
    .max(100, "Project name should be a maximum of 100 characters"),
});

type ProjectNameForm = z.infer<typeof projectNameSchema>;

function SettingsLoading() {
  return (
    <main className="p-6 md:p-8">
      <Skeleton className="h-9 w-48" />
      <Card className="mt-6 border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-20" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-28" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-5 w-16" />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export function ProjectOverviewSettingsPage() {
  const groupId = useConsoleProjectStore((s) => s.selectedTenantGroup) ?? "";
  const selectedProject = useConsoleProjectStore((s) => s.selectedProject);
  const setSelectedProject = useConsoleProjectStore((s) => s.setSelectedProject);
  const { data: userRes } = useIamCurrentUser();
  const { data: projectsData, isLoading } = useConsoleProjects(groupId);
  const project = projectsData?.[0]?.projects?.[0];
  const { mutateAsync: updateGroup, isPending: isUpdating } = useUpdateTenantGroupMutation();
  const [editOpen, setEditOpen] = useState(false);

  const form = useForm<ProjectNameForm>({
    resolver: zodResolver(projectNameSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (project?.name) form.reset({ name: project.name });
  }, [project?.name, form]);

  useEffect(() => {
    if (project && selectedProject?.itemId === project.itemId && selectedProject.name !== project.name) {
      setSelectedProject(project);
    }
  }, [project, selectedProject, setSelectedProject]);

  if (isLoading || !groupId) return <SettingsLoading />;

  const currentUserId = userRes?.data?.itemId;
  const canEdit = project?.createdBy === currentUserId;

  const onSave = form.handleSubmit(async (values) => {
    if (!project || !groupId) return;
    try {
      const res = await updateGroup({
        name: values.name.trim(),
        tenantGroupId: groupId,
      });
      if (res.errors) {
        showErrorToast({ errors: "Failed to update project name" });
      } else {
        showSuccessToast({ description: "Project name updated successfully" });
        setEditOpen(false);
      }
    } catch {
      showErrorToast({ errors: "An unexpected error occurred" });
    }
  });

  return (
    <main className="min-h-0 flex-1 p-6 pt-8 md:p-8">
      <PageMeta title="Project Settings" />
      <h1 className="text-lg font-semibold md:text-xl">Project Settings</h1>
      <Card className="mt-6 border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">General Information</CardTitle>
          {canEdit ? (
            <Button
              size="sm"
              variant="outline"
              className="h-10"
              type="button"
              aria-label="Edit project name"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium text-foreground">{project?.name ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Created On</p>
              <p className="font-medium text-foreground">{formatProjectDateTime(project?.createdDate)}</p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Plan</p>
            <p className="font-medium text-foreground">Free</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={onSave}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="po-project-name">Project name</Label>
                  <FormField
                    name="name"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            id="po-project-name"
                            onChange={(e) => {
                              field.onChange(e);
                              void form.trigger("name");
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={isUpdating}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdating || !form.formState.isValid}>
                  {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
