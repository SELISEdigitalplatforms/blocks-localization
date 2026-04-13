import { publicAsset } from "@/lib/public-asset";
import { PageMeta } from "@/seo/page-meta";
import { Check } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

export function SignupEmailSentPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";

  return (
    <div className="thin-scrollbar flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto overscroll-y-contain bg-background">
      <PageMeta title="Email sent" />
      <div className="mb-4 p-4 sm:mt-[-252px]">
        <img
          src={publicAsset("Logo.svg")}
          width={128}
          height={55}
          alt="SELISE Blocks logo"
          className="h-[55px] w-auto max-w-[min(100%,200px)] object-contain"
        />
      </div>
      <Check className="my-6 text-[#17C964]" size={40} aria-hidden />
      <div className="mx-auto flex w-11/12 flex-col items-center gap-1 text-center sm:max-w-2xl">
        <h3 className="my-6 text-3xl font-bold tracking-tight">Email sent</h3>
        <p className="text-xl text-foreground">
          An email has been sent to{" "}
          <span className="font-semibold text-primary underline">{email || "your address"}</span>.
          Please, follow the link on the email to continue your sign up.
        </p>
        <Link to="/login" className="text-primary mt-8 text-sm underline">
          Back to log in
        </Link>
      </div>
    </div>
  );
}
