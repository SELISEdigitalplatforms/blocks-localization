
import { environmentOptions } from "@/features/console/constants/environment-options";
import { useConsoleProjects } from "@/features/console/hooks/use-console-projects";
import { useDataMigrationFormState } from "@/features/console/data-migration/data-migration-form-store";
import {
  environmentServiceSelectionFormDefaultValue,
  environmentServiceSelectionFormSchema,
} from "@/features/console/data-migration/environment-service-selection-utils";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { useCreateProjectStepper } from "@/features/create-project/stepper/create-project-stepper-provider";
import { Badge } from "@/platform/ui/components/badge/badge";
import { Button } from "@/platform/ui/components/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/platform/ui/components/card/card";
import { Checkbox } from "@/platform/ui/components/checkbox/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/platform/ui/components/form/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/platform/ui/components/select/select";
import { Switch } from "@/platform/ui/components/switch/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/platform/ui/components/tooltip/tooltip";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

const availableServices = [
  { id: "Email" as const, name: "Email", chips: ["Templates"] as const, available: true },
  { id: "Language" as const, name: "Language", chips: ["Key", "Module"] as const, available: true },
];

export function EnvironmentServiceSelectionForm() {
  const { formData, setFormData } = useDataMigrationFormState();
  const { nextStep } = useCreateProjectStepper();
  const groupId = useConsoleProjectStore((s) => s.selectedTenantGroup) ?? "";
  const { data: projectGroups = [], isLoading } = useConsoleProjects(groupId);

  const form = useForm({
    values: formData[0],
    resolver: zodResolver(environmentServiceSelectionFormSchema),
  });

  const onSubmitHandler = (values: typeof environmentServiceSelectionFormDefaultValue) => {
    setFormData(0, values);
    nextStep();
  };

  const { isValid } = form.formState;
  const selectedServices = form.watch("services");
  const sourceEnvironment = form.watch("sourceEnvironment");
  const targetEnvironment = form.watch("targetEnvironment");

  const projectEnvironmentOptions = useMemo(() => {
    if (!groupId || isLoading) return [];
    const currentTenantGroup = projectGroups.find((g) => g.tenantGroupId === groupId);
    if (!currentTenantGroup) return [];
    return currentTenantGroup.projects.map((project) => {
      const envOption = environmentOptions.find((env) => env.value === project.environment);
      return {
        value: project.tenantId,
        label: envOption?.label || project.environment,
        environment: project.environment,
        projectId: project.itemId,
      };
    });
  }, [projectGroups, groupId, isLoading]);

  return (
    <TooltipProvider>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmitHandler)}>
          <div className="mt-4 flex flex-col gap-1 text-left">
            <p className="text-3xl font-bold tracking-tight">Select environments & services</p>
            <p className="mb-8 text-sm text-muted-foreground">
              Choose the source and target environments, then select which services to migrate.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="mb-4 text-lg font-semibold">Environments</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="sourceEnvironment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source environment</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          if (value === targetEnvironment) return;
                          field.onChange(value);
                          const selectedOption = projectEnvironmentOptions.find((opt) => opt.value === value);
                          if (selectedOption) {
                            form.setValue("sourceEnvironmentName", selectedOption.label);
                          }
                        }}
                        value={field.value || undefined}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                isLoading ? "Loading environments..." : "Select source environment"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projectEnvironmentOptions.map((option) => {
                            const isDisabled = option.value === targetEnvironment;
                            return (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                disabled={isDisabled}
                                className={isDisabled ? "cursor-not-allowed opacity-50" : ""}
                              >
                                {option.label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetEnvironment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target environment</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          if (value === sourceEnvironment) return;
                          field.onChange(value);
                          const selectedOption = projectEnvironmentOptions.find((opt) => opt.value === value);
                          if (selectedOption) {
                            form.setValue("targetEnvironmentName", selectedOption.label);
                          }
                        }}
                        value={field.value || undefined}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                isLoading ? "Loading environments..." : "Select target environment"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projectEnvironmentOptions.map((option) => {
                            const isDisabled = option.value === sourceEnvironment;
                            return (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                disabled={isDisabled}
                                className={isDisabled ? "cursor-not-allowed opacity-50" : ""}
                              >
                                {option.label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-lg font-semibold">Services</h3>
              <FormField
                control={form.control}
                name="services"
                render={() => (
                  <FormItem>
                    <div className="grid grid-cols-1 gap-4">
                      {availableServices.map((service) => (
                        <Card
                          key={service.id}
                          className={`cursor-pointer transition-colors ${
                            !service.available
                              ? "cursor-not-allowed opacity-50"
                              : selectedServices.some((s) => s.name === service.id && s.selected)
                                ? "border-primary"
                                : "hover:border-primary/50"
                          }`}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <FormField
                                  control={form.control}
                                  name="services"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.some(
                                            (s) => s.name === service.id && s.selected,
                                          )}
                                          disabled={!service.available}
                                          onCheckedChange={(checked) => {
                                            const currentServices = field.value || [];
                                            if (checked) {
                                              const existingIndex = currentServices.findIndex(
                                                (s) => s.name === service.id,
                                              );
                                              if (existingIndex >= 0) {
                                                const updated = [...currentServices];
                                                updated[existingIndex] = {
                                                  ...updated[existingIndex],
                                                  selected: true,
                                                };
                                                field.onChange(updated);
                                              } else {
                                                field.onChange([
                                                  ...currentServices,
                                                  {
                                                    name: service.id,
                                                    label: service.name,
                                                    selected: true,
                                                    overrideData: false,
                                                  },
                                                ]);
                                              }
                                            } else {
                                              const updated = currentServices.map((s) =>
                                                s.name === service.id ? { ...s, selected: false } : s,
                                              );
                                              field.onChange(updated);
                                            }
                                          }}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                <div className="flex-1">
                                  <CardTitle className="text-base font-medium">{service.name}</CardTitle>
                                </div>
                              </div>
                              {service.available &&
                                selectedServices.some((s) => s.name === service.id && s.selected) && (
                                  <FormField
                                    control={form.control}
                                    name="services"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                        {field.value?.find((s) => s.name === service.id)?.overrideData ? (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="flex cursor-help items-center space-x-1">
                                                <FormLabel className="text-xs font-normal text-muted-foreground">
                                                  Overwrite data
                                                </FormLabel>
                                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>
                                                This will overwrite existing data in the target environment
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        ) : (
                                          <div className="flex items-center space-x-1">
                                            <FormLabel className="text-xs font-normal text-muted-foreground">
                                              Overwrite data
                                            </FormLabel>
                                          </div>
                                        )}
                                        <FormControl>
                                          <Switch
                                            checked={
                                              field.value?.find((s) => s.name === service.id)
                                                ?.overrideData || false
                                            }
                                            onCheckedChange={(checked) => {
                                              const currentServices = field.value || [];
                                              const updated = currentServices.map((s) =>
                                                s.name === service.id
                                                  ? { ...s, overrideData: !!checked }
                                                  : s,
                                              );
                                              field.onChange(updated);
                                            }}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                )}
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {service.available ? (
                              <div className="flex flex-wrap gap-2">
                                {service.chips.map((chip) => (
                                  <Badge key={chip} variant="secondary" className="text-xs">
                                    {chip}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">Not available for this service</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="mb-8 mt-8 flex">
            <Button type="submit" disabled={!isValid}>
              Continue
            </Button>
          </div>
        </form>
      </Form>
    </TooltipProvider>
  );
}
