import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/platform/ui/components/card/card";
import { showErrorToast } from "@/platform/ui/hooks/use-toast";
import { GRANT_TYPES } from "@/features/auth/model/types";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { SigninForm } from "@/features/auth/components/signin-form";
import { SsoSignin } from "@/features/auth/components/sso-signin";
import { getLoginOptions, getSignUpSetting } from "@/features/auth/services/auth-api";
import { env } from "@/config/env";

export function Signin() {
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoError = params.get("ssoError");
    if (ssoError) {
      showErrorToast({ errors: ssoError });
    }
  }, []);

  if (isLoginOptionLoading || (projectKey ? isSignUpSettingLoading : false)) {
    return (
      <Card className="flex h-full flex-col rounded border-solid border-background shadow-none md:min-w-md md:border-[#95ADC4] lg:max-w-md">
        <CardContent className="flex flex-1 items-center justify-center">
          <p>Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!loginOption || loginOption.allowedGrantTypes?.length < 1) return null;

  const showSignUp =
    signUpSetting?.isEmailPasswordSignUpEnabled || signUpSetting?.isSSoSignUpEnabled;

  return (
    <Card className="flex h-full flex-col rounded border-solid border-background shadow-none md:min-w-md md:border-[#95ADC4] lg:max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl">Blocks Cloud</CardTitle>
        <CardDescription className="text-xl text-foreground">Log in</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between">
        <div className="flex flex-1 flex-col justify-center">
          {loginOption.allowedGrantTypes.includes(GRANT_TYPES.password) && <SigninForm />}
          {loginOption.allowedGrantTypes.includes(GRANT_TYPES.password) && (
            <div className="my-2 mt-4 flex items-center">
              <hr className="grow border" />
              <span className="text-muted-foreground mx-2 text-xs">OR</span>
              <hr className="grow border" />
            </div>
          )}
          {loginOption.allowedGrantTypes.includes(GRANT_TYPES.social) && (
            <SsoSignin loginOption={loginOption} />
          )}
        </div>
        {showSignUp && (
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground mt-3 flex items-center">
              <p>Not a member?</p>
              <Link to="/signup" className="ml-2 inline-block text-sm text-primary">
                Sign up
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
