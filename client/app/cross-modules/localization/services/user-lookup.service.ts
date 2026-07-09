import { serviceInstances } from "@/lib/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";

export interface LocalizationUser {
  firstName: string;
  lastName: string;
  email: string;
  userName: string;
}

export interface IamUser {
  itemId: string;
  firstName: string;
  lastName: string;
  email: string;
  userName: string;
  organizationId: string;
}

interface GetUserByIdResponse {
  data: LocalizationUser;
  errors: unknown;
}

interface GetMeResponse {
  data: IamUser;
  errors: unknown;
}

const getIamBaseUrl = () => {
  const iamBaseUrl =
    getRuntimeEnv("BLOCKS_IAM_BASE_URL") ||
    "https://dev-iam.blocksdevelopers.com";
  return `${iamBaseUrl}/api/iam`;
};

class UserLookupService {
  private readonly httpClient = serviceInstances.idpService;

  getMe(): Promise<GetMeResponse> {
    return this.httpClient.get(
      `${getIamBaseUrl()}/me`,
      undefined,
      {
        absoluteUrl: true,
      },
    );
  }

  getUserById(payload: {
    id: string;
    organizationId: string;
  }): Promise<GetUserByIdResponse> {
    const params = new URLSearchParams({
      organizationId: payload.organizationId,
    });

    return this.httpClient.get(
      `${getIamBaseUrl()}/users/${payload.id}?${params.toString()}`,
      undefined,
      {
        absoluteUrl: true,
      },
    );
  }
}

export const userLookupService = new UserLookupService();
