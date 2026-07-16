import { describe, expect, it } from "vitest";

import { GRANT_TYPES, SSO_PROVIDERS } from "@/models/project.model";
import {
  GRANT_TYPES as IdGrantTypes,
  SSO_PROVIDERS as IdSsoProviders,
} from "@blocks-identifier/models/project.model";

describe("models/project.model", () => {
  it("GRANT_TYPES should expose the four grant flows", () => {
    expect(GRANT_TYPES.password).toBe("password");
    expect(GRANT_TYPES.social).toBe("social");
    expect(GRANT_TYPES.clientCredential).toBe("client_credential");
    expect(GRANT_TYPES.authorizationCode).toBe("authorization_code");
  });

  it("SSO_PROVIDERS should expose the supported providers", () => {
    expect(SSO_PROVIDERS.google).toBe("google");
    expect(SSO_PROVIDERS.microsoft).toBe("microsoft");
    expect(SSO_PROVIDERS.apple).toBe("apple");
    expect(Object.keys(SSO_PROVIDERS)).toHaveLength(8);
  });
});

describe("identifier/models/project.model", () => {
  it("should mirror the app-level GRANT_TYPES/SSO_PROVIDERS values", () => {
    expect(IdGrantTypes.authorizationCode).toBe("authorization_code");
    expect(IdSsoProviders.ownsso).toBe("ownsso");
  });
});
