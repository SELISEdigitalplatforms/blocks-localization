
import { useDataMigrationFormState } from "@/features/console/data-migration/data-migration-form-store";
import { useInitiateMigration, useVerifyMigration } from "@/features/console/hooks/use-data-migration";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { Button } from "@/platform/ui/components/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/platform/ui/components/card/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/platform/ui/components/form/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/platform/ui/components/input-otp/input-otp";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/platform/ui/components/tooltip/tooltip";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCountDown } from "@/hooks/use-count-down";
import { AlertTriangle, Check } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

const verificationSchema = z.object({
  verificationCode: z
    .string()
    .min(5, "Verification code must be 5 digits")
    .max(5, "Verification code must be 5 digits"),
});

const serviceNameToNumber: Record<string, number> = {
  Authentication: 0,
  IAM: 1,
  MFA: 2,
  CAPTCHA: 3,
  Email: 4,
  DataGateway: 5,
  Notifications: 6,
  Storage: 7,
  Language: 8,
};

function CustomInputOTPSlot({ index }: { index: number }) {
  return (
    <InputOTPSlot
      index={index}
      className="h-12 w-[46px] rounded-sm border px-4 py-3.5 first:rounded-l-sm first:border-l last:rounded-r-sm"
    />
  );
}

export function ReviewConfirmForm() {
  const navigate = useNavigate();
  const { formData } = useDataMigrationFormState();
  const selectedTenantGroup = useConsoleProjectStore((s) => s.selectedTenantGroup);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const { remainingTime, reset } = useCountDown(300);

  const { mutateAsync: initiateMigration, isPending: isInitiating } = useInitiateMigration();
  const { mutateAsync: verifyMigration, isPending: isVerifying } = useVerifyMigration();

  const verificationForm = useForm({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      verificationCode: "",
    },
  });

  const buildServicesPayload = () =>
    formData[0].services
      .filter((service) => service.selected)
      .map((service) => ({
        shouldOverWriteExistingData: service.overrideData,
        serviceName: serviceNameToNumber[service.name] ?? 0,
      }));

  const handleStartMigration = async () => {
    if (!selectedTenantGroup) {
      showErrorToast({ errors: "No project selected" });
      return;
    }

    try {
      const response = await initiateMigration({
        projectKey: formData[0].sourceEnvironment,
        targetedProjectKey: formData[0].targetEnvironment,
        tenantGroupId: selectedTenantGroup,
        services: buildServicesPayload(),
      });

      if (response.isSuccess) {
        setVerificationId(response.verificationId);
        setIsVerificationModalOpen(true);
        reset();
      } else {
        showErrorToast({ errors: "Failed to initiate migration" });
      }
    } catch {
      showErrorToast({ errors: "An error occurred while initiating migration" });
    }
  };

  const handleResendVerification = async () => {
    if (!selectedTenantGroup) {
      showErrorToast({ errors: "No project selected" });
      return;
    }

    try {
      const response = await initiateMigration({
        projectKey: formData[0].sourceEnvironment,
        targetedProjectKey: formData[0].targetEnvironment,
        tenantGroupId: selectedTenantGroup,
        services: buildServicesPayload(),
      });

      if (response.isSuccess) {
        setVerificationId(response.verificationId);
        reset();
        showSuccessToast({ description: "Verification code sent successfully!" });
      } else {
        showErrorToast({ errors: "Failed to resend verification code" });
      }
    } catch {
      showErrorToast({ errors: "An error occurred while resending verification code" });
    }
  };

  const handleVerifyMigration = async (values: { verificationCode: string }) => {
    try {
      const response = await verifyMigration({
        verificationId,
        verificationCode: values.verificationCode,
      });

      if (response.isSuccess && response.isValid) {
        showSuccessToast({ description: "Migration started successfully!" });
        setIsVerificationModalOpen(false);
        void navigate("/project-overview/environments");
      } else {
        showErrorToast({ errors: "Invalid verification code" });
      }
    } catch {
      showErrorToast({ errors: "An error occurred during verification" });
    }
  };

  const selectedServices = formData[0].services.filter((service) => service.selected);

  return (
    <>
      <div className="mt-4 flex flex-col gap-6 text-left">
        <div>
          <p className="text-3xl font-bold tracking-tight">Review & confirm</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check the details below before starting the migration.
          </p>
        </div>

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/30">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Please note:</strong> You are about to migrate data across environments. Please ensure
            that all the details below are correct, as this action is permanent.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Source environment</p>
                <p className="text-base font-medium">
                  {formData[0].sourceEnvironmentName || formData[0].sourceEnvironment}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Target environment</p>
                <p className="text-base font-medium">
                  {formData[0].targetEnvironmentName || formData[0].targetEnvironment}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Services selected</p>
              <TooltipProvider>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {selectedServices.map((service) => (
                    <Tooltip key={service.name}>
                      <TooltipTrigger asChild>
                        <div className="flex cursor-pointer items-center p-2 transition-colors">
                          <div className="flex h-4 w-4 items-center justify-center rounded-full">
                            <Check className="h-4 w-4 text-[#17C964]" />
                          </div>
                          <span className="ml-2 text-sm font-medium text-foreground">{service.label}</span>
                          {service.overrideData ? (
                            <AlertTriangle className="ml-1 h-4 w-4 text-amber-500" />
                          ) : null}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-center">
                          {service.overrideData ? (
                            <p className="text-xs text-muted-foreground">
                              This will overwrite existing data in the target environment
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Overwriting data disabled</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button onClick={handleStartMigration} disabled={isInitiating || selectedServices.length === 0}>
            {isInitiating ? "Starting migration..." : "Start migration"}
          </Button>
        </div>
      </div>

      <Dialog open={isVerificationModalOpen} onOpenChange={setIsVerificationModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify your migration</DialogTitle>
            <DialogDescription>
              You&apos;re about to migrate services from{" "}
              <strong>{formData[0].sourceEnvironmentName || formData[0].sourceEnvironment}</strong> to{" "}
              <strong>{formData[0].targetEnvironmentName || formData[0].targetEnvironment}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We&apos;ve sent a verification code to your email. Enter the code below to continue.
            </p>

            <Form {...verificationForm}>
              <form
                onSubmit={verificationForm.handleSubmit(handleVerifyMigration)}
                className="space-y-4"
              >
                <FormField
                  control={verificationForm.control}
                  name="verificationCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verification code</FormLabel>
                      <FormControl>
                        <InputOTP maxLength={5} {...field}>
                          <InputOTPGroup className="gap-4">
                            <CustomInputOTPSlot index={0} />
                            <CustomInputOTPSlot index={1} />
                            <CustomInputOTPSlot index={2} />
                            <CustomInputOTPSlot index={3} />
                            <CustomInputOTPSlot index={4} />
                          </InputOTPGroup>
                        </InputOTP>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="text-sm text-muted-foreground">
                  <p>
                    Did not receive mail?{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-sm font-medium !no-underline"
                      disabled={!!remainingTime || isInitiating}
                      onClick={handleResendVerification}
                    >
                      {remainingTime
                        ? `Resend in (${Math.floor(remainingTime / 60)}:${String(remainingTime % 60).padStart(2, "0")})`
                        : "Resend"}
                    </Button>
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsVerificationModalOpen(false)}
                    disabled={isVerifying}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isVerifying}>
                    {isVerifying ? "Verifying..." : "Verify & Begin"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
