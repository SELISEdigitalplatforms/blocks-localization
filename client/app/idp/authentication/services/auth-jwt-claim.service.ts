import { serviceInstances } from "@/lib/http-client";
import { JwtClaimPayload } from "@blocks-idp/authentication/models/jwt.claim.model";
import { PROJECT_ENDPOINTS } from "@blocks-identifier/constants/endpoint.constant";

class JwtClaimServices {
  private readonly httpClient = serviceInstances.idpService;

  addJwtClaim(payload: JwtClaimPayload): Promise<{
    errors: unknown | null;
    isSuccess: boolean;
  }> {
    return this.httpClient.post(PROJECT_ENDPOINTS.ADD_JWT_CLAIM, payload);
  }
}

export const jwtClaimServices = new JwtClaimServices();
