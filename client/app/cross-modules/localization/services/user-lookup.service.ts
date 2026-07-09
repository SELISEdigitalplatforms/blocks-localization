import { serviceInstances } from "@/lib/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";

export interface LocalizationUser {
  firstName: string;
  lastName: string;
  email: string;
  userName: string;
}

interface GetUserByIdResponse {
  data: LocalizationUser;
  errors: unknown;
}

const getIamUsersEndpoint = () => {
  const iamBaseUrl =
    getRuntimeEnv("BLOCKS_IAM_BASE_URL") ||
    "https://dev-iam.blocksdevelopers.com";
  return `${iamBaseUrl}/api/iam/users`;
};

class UserLookupService {
  private readonly httpClient = serviceInstances.idpService;

  getUserById(payload: {
    id: string;
    organizationId: string;
  }): Promise<GetUserByIdResponse> {
    const params = new URLSearchParams({
      organizationId: payload.organizationId,
    });

    return this.httpClient.get(
      `${getIamUsersEndpoint()}/${payload.id}?${params.toString()}`,
      undefined,
      {
        absoluteUrl: true,
      },
    );
  }
}

export const userLookupService = new UserLookupService();
