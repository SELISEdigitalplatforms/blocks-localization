
import { env } from "@/config/env";
import { ProfileImageUploader } from "@/features/profile/components/profile-image-uploader";
import { ProfileMFA } from "@/features/profile/components/profile-mfa/profile-mfa";
import { UserBasicInformation } from "@/features/profile/components/user-basic-information";

export function ProfileDetails({ id }: { id: string }) {
  const projectKey = env.xBlocksKey || "";
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 xl:gap-8">
      <ProfileImageUploader id={id} projectKey={projectKey} />
      <div className="lg:col-span-9">
        <UserBasicInformation id={id} projectKey={projectKey} />
        <div className="mt-5">
          <ProfileMFA userId={id} projectKey={projectKey} />
        </div>
      </div>
    </div>
  );
}
