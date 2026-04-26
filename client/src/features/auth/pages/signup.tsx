import { Card, CardContent } from "@/platform/ui/components/card/card";
import { useQuery } from "@tanstack/react-query";
import { getLoginOptions, getSignUpSetting } from "@/features/auth/services/auth-api";
import { env } from "@/config/env";
import { SignupForm } from "@/features/auth/components/signup-form";

export function Signup() {
  const projectKey = env.xBlocksKey || "";

  const { data: loginOption, isLoading: isLoginOptionLoading } = useQuery({
    queryKey: ["login-options"],
    queryFn: getLoginOptions,
  });

  const { data: signUpSetting, isLoading: isSignUpSettingLoading } = useQuery({
    queryKey: ["sign-up-setting", projectKey],
    queryFn: () => getSignUpSetting(projectKey),
    enabled: Boolean(projectKey),
  });

  if (isLoginOptionLoading || (projectKey ? isSignUpSettingLoading : false)) {
    return (
      <Card className="flex h-full flex-col rounded border-solid border-background shadow-none md:min-w-md md:border-[#95ADC4] lg:max-w-md">
        <CardContent className="flex flex-1 items-center justify-center">
          <p>Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!loginOption || loginOption.allowedGrantTypes.length < 1) return null;

  return (
    <SignupForm
      loginOption={loginOption}
      emailSignUpEnabled={signUpSetting?.isEmailPasswordSignUpEnabled ?? false}
      ssoSignUpEnabled={signUpSetting?.isSSoSignUpEnabled ?? false}
    />
  );
}
