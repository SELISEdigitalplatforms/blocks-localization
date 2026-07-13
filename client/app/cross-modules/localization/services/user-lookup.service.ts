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
  organizationId?: string;
}

interface GetUsersResponse {
  totalCount: number;
  data: IamUser[];
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
  private readonly usersPageSize = 100;

  getMe(): Promise<GetMeResponse> {
    return this.httpClient.get(
      `${getIamBaseUrl()}/me`,
      undefined,
      {
        absoluteUrl: true,
      },
    );
  }

  getUsers(payload: {
    page: number;
    pageSize: number;
    email?: string;
    name?: string;
  }): Promise<GetUsersResponse> {
    return this.httpClient.post(
      `${getIamBaseUrl()}/users`,
      {
        page: payload.page,
        pageSize: payload.pageSize,
        sort: {
          property: "FirstName",
          isDescending: false,
        },
        filter: {
          email: payload.email ?? "",
          name: payload.name ?? "",
        },
      },
      undefined,
      {
        absoluteUrl: true,
      },
    );
  }

  async getUsersByIds(userIds: string[]): Promise<Record<string, LocalizationUser>> {
    const targetUserIds = new Set(userIds.filter(Boolean));
    const usersById: Record<string, LocalizationUser> = {};

    if (targetUserIds.size === 0) {
      return usersById;
    }

    let page = 0;
    let totalCount = Number.POSITIVE_INFINITY;

    while (
      page * this.usersPageSize < totalCount &&
      Object.keys(usersById).length < targetUserIds.size
    ) {
      const response = await this.getUsers({
        page,
        pageSize: this.usersPageSize,
      });

      totalCount = response.totalCount ?? 0;

      for (const user of response.data ?? []) {
        if (targetUserIds.has(user.itemId)) {
          usersById[user.itemId] = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            userName: user.userName,
          };
        }
      }

      page += 1;
    }

    return usersById;
  }
}

export const userLookupService = new UserLookupService();
