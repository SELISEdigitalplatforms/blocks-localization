/** Mirrors `src/models/people.ts` / identifier list + `GetPeople` API. */

export interface SharedEnvironment {
  itemId: string;
  tenantId: string;
  isInvitationSent: boolean;
  isInvitationConfirmed: boolean;
  isCreator: boolean;
  /** API typo preserved */
  enviroment: string;
}

export interface PeopleDetails {
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl: string | null;
  userId: string;
  allowResendActivation: boolean;
}

export interface PeopleGroupedByEnvironments {
  peopleDetails: PeopleDetails;
  sharedEnviroments: SharedEnvironment[];
}

export interface GetPeopleResponse {
  peoples: PeopleGroupedByEnvironments[];
  totalCount: number;
  errors: null | unknown;
  isSuccess: boolean;
  isOwner: boolean;
}

export type InvitePeoplePayload = {
  invitations: Record<string, string[]>;
  groupId: string;
};

export type ResendInvitationPayload = {
  email: string;
  groupId: string;
};

export type TransferOwnershipPayload = {
  tenantGroupId: string;
  transferToUserEmail: string;
};

export type IdentifierMutationResponse = {
  errors: null | unknown;
  isSuccess: boolean;
};
