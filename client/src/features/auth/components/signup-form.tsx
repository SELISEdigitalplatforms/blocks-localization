import { Button } from "@/platform/ui/components/button/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/platform/ui/components/card/card";
import { Checkbox } from "@/platform/ui/components/checkbox/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/platform/ui/components/form/form";
import { Input } from "@/platform/ui/components/input/input";
import { showErrorToast } from "@/platform/ui/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { GRANT_TYPES, type LoginOption } from "@/features/auth/model/types";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SsoSignin } from "@/features/auth/components/sso-signin";
import { signupFormDefaultValue, signupFormSchema } from "@/features/auth/utils/signup-utils";
import { signupByEmail } from "@/features/auth/services/auth-api";
import { env } from "@/config/env";
import { HttpError } from "@/platform/api/idp-http";
import { ReCaptcha, type ReCaptchaWidgetRef } from "@/features/auth/components/re-captcha";
import { usePrefersDark } from "@/features/auth/hooks/use-prefers-dark";

export function SignupForm({
  loginOption,
  emailSignUpEnabled,
  ssoSignUpEnabled,
}: {
  loginOption: LoginOption;
  emailSignUpEnabled: boolean;
  ssoSignUpEnabled: boolean;
}) {
  const [isChecked, setIsChecked] = useState(false);
  const [captchaCode, setCaptchaCode] = useState("");
  const navigate = useNavigate();
  const captchaRef = useRef<ReCaptchaWidgetRef>(null);
  const dark = usePrefersDark();
  const googleSiteKey = env.googleSiteKey || "";
  const captchaRequired = Boolean(googleSiteKey);

  const form = useForm({
    defaultValues: signupFormDefaultValue,
    resolver: zodResolver(signupFormSchema),
  });

  const { isPending, mutateAsync } = useMutation({
    mutationKey: ["signup", "email"],
    mutationFn: signupByEmail,
  });

  const { isValid } = form.formState;

  const resetCaptcha = () => {
    captchaRef.current?.reset();
    setCaptchaCode("");
  };

  const onSubmitHandler = async (values: z.infer<typeof signupFormSchema>) => {
    try {
      const res = await mutateAsync({
        ...values,
        captchaCode: captchaRequired ? captchaCode : "",
      });
      if (!res.isSuccess) {
        resetCaptcha();
        return showErrorToast({ errors: res.errors });
      }
      navigate(`/signup-email-sent?email=${encodeURIComponent(values.email)}`);
    } catch (error: unknown) {
      resetCaptcha();
      if (error instanceof HttpError) {
        showErrorToast({ errors: error.errors });
      } else if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      } else {
        showErrorToast({ errors: "Something went wrong" });
      }
    }
  };

  useEffect(() => {
    if (!isValid && captchaCode) {
      captchaRef.current?.reset();
      setCaptchaCode("");
    }
  }, [captchaCode, isValid]);

  const canSubmit =
    isValid &&
    isChecked &&
    (!captchaRequired || captchaCode.length > 0) &&
    !isPending;

  const recaptchaTheme = dark ? "dark" : "light";

  return (
    <Card className="w-full rounded border-solid border-background shadow-none md:border-[#95ADC4] lg:max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl leading-9">Blocks Cloud</CardTitle>
        <CardDescription className="text-xl text-foreground">Sign Up</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)}>
            {emailSignUpEnabled && (
              <div className="grid gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter your email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isValid && captchaRequired && (
                  <ReCaptcha
                    ref={captchaRef}
                    siteKey={googleSiteKey}
                    theme={recaptchaTheme}
                    onVerify={setCaptchaCode}
                    onExpired={() => setCaptchaCode("")}
                    onError={() => setCaptchaCode("")}
                  />
                )}

                <div className="mt-2 flex justify-start gap-2 text-sm text-foreground">
                  <Checkbox
                    id="terms"
                    checked={isChecked}
                    onCheckedChange={(checked) => setIsChecked(!!checked)}
                    className="mt-1 shrink-0"
                  />
                  <label
                    htmlFor="terms"
                    className="cursor-pointer text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I agree to the{" "}
                    <a
                      href="https://selisegroup.com/software-development-terms/"
                      className="text-primary underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Terms of Services{" "}
                    </a>
                    and acknowledge that I have read the{" "}
                    <a
                      href="https://selisegroup.com/privacy-policy/"
                      className="text-primary underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Privacy policy.
                    </a>
                  </label>
                </div>
                <Button type="submit" className="w-full rounded" disabled={!canSubmit}>
                  Continue
                </Button>
              </div>
            )}
          </form>
        </Form>
        {ssoSignUpEnabled && emailSignUpEnabled && (
          <div className="my-2 flex items-center">
            <hr className="grow border-gray-300" />
            <span className="mx-2 text-xs text-gray-500">OR</span>
            <hr className="grow border-gray-300" />
          </div>
        )}

        {ssoSignUpEnabled && loginOption.allowedGrantTypes.includes(GRANT_TYPES.social) && (
          <SsoSignin loginOption={loginOption} />
        )}

        <div className="mt-4 text-center text-base text-foreground">
          Already a member?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
