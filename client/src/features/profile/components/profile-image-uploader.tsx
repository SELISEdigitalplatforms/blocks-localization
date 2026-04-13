
import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/platform/ui/components/button/button";
import { useGetPreSignedUrlForUpload, useUploadFileToBlob } from "@/features/uilm/hooks/use-storage-upload";
import { storageFileService } from "@/platform/storage/storage-file.service";
import { useProfileUserById } from "@/features/profile/hooks/use-profile-user-by-id";
import { useProfileUpdateUser } from "@/features/profile/hooks/use-profile-update-user";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { HttpError } from "@/platform/api/idp-http";
import { ModuleName } from "@/features/uilm/constants/modules.constants";

const emptyProfilePhoto = `${import.meta.env.BASE_URL}assets/images/empty-profile-photo.png`;

type ProfileImageUploaderProps = { projectKey: string; id: string };

export function ProfileImageUploader({ projectKey, id }: ProfileImageUploaderProps) {
  const [image, setImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data } = useProfileUserById({ id, projectKey });
  const { mutateAsync } = useGetPreSignedUrlForUpload();
  const { mutateAsync: uploadImageMutate } = useUploadFileToBlob();
  const { mutateAsync: updateUserMutate } = useProfileUpdateUser({ projectKey, id, own: true });
  const [isProfileImageUploading, setIsProfileImageUploading] = useState<boolean>(false);

  useEffect(() => {
    if (data?.data) setImage(data.data.profileImageUrl);
  }, [data?.data, data?.data.profileImageUrl]);

  const uploadImage = async (file: File) => {
    try {
      setIsProfileImageUploading(true);
      const res = await mutateAsync({
        itemId: "",
        accessModifier: "Public",
        configurationName: "Default",
        name: file.name,
        projectKey,
        tags: "",
        metaData: "",
        parentDirectoryId: "",
        moduleName: ModuleName.IAMCloud,
      });
      if (!res.isSuccess) return;
      const profileImageId = res.fileId;
      await uploadImageMutate({ url: res.uploadUrl, file });
      const userProfileFile = await storageFileService.getFileByFileId({
        itemId: profileImageId,
        projectKey,
      });
      const updatedUser = await updateUserMutate({
        ...data?.data,
        itemId: id,
        projectKey,
        profileImageId: userProfileFile.itemId,
        profileImageUrl: userProfileFile.url,
      });
      if (!updatedUser.isSuccess) return showErrorToast({ errors: updatedUser.errors });
      showSuccessToast({ description: "Profile pic updated successfully" });
    } catch (error) {
      if (error instanceof HttpError) return showErrorToast({ errors: error.errors });
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      return showErrorToast({ errors: "Something went wrong" });
    } finally {
      setIsProfileImageUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const MAX_SIZE_MB = 5;
    const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml"];

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      event.target.value = "";
      return showErrorToast({
        errors: "Only image files (PNG, JPG, GIF, WebP, and SVG) are allowed",
      });
    }

    if (selectedFile.size > MAX_SIZE_MB * 1024 * 1024) {
      event.target.value = "";
      return showErrorToast({ errors: `File size must be less than ${MAX_SIZE_MB}MB` });
    }

    setImage(URL.createObjectURL(selectedFile));
    void uploadImage(selectedFile);
    event.target.value = "";
  };

  return (
    <div className="flex flex-col items-center justify-center gap-8 lg:col-span-3 lg:justify-start">
      <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-full bg-gray-50 dark:bg-gray-800">
        {image ? (
          <>
            <img src={image} alt="Profile" className="h-full w-full rounded-full object-cover" />
            {isProfileImageUploading ? (
              <div className="absolute inset-0 rounded-full bg-gray-50 opacity-75 dark:bg-gray-800" />
            ) : null}
          </>
        ) : (
          <img src={emptyProfilePhoto} alt="Empty profile" className="h-full w-full rounded-full object-cover" />
        )}
      </div>
      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
      <Button
        variant="outline"
        disabled={isProfileImageUploading}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
      >
        <Camera className="h-5 w-5" />
        <span className="ml-2.5">Change Image</span>
      </Button>
    </div>
  );
}
