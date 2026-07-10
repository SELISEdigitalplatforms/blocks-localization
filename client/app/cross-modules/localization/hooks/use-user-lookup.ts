import { useQuery } from "@tanstack/react-query";
import { userLookupService } from "@blocks-localization/services/user-lookup.service";

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ["iam", "me"],
    queryFn: async () => {
      const response = await userLookupService.getMe();
      return response.data;
    },
    staleTime: Infinity,
  });
};

export const useUserOrganizationId = () => {
  const { data: user } = useCurrentUser();
  return user?.organizationId;
};
