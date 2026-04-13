import type {
  GetPeopleResponse,
  InvitePeoplePayload,
  IdentifierMutationResponse,
  ResendInvitationPayload,
  TransferOwnershipPayload,
} from "@/features/console/model/people";
import { idpPostJson } from "@/platform/api/idp-http";

export type GetPeopleRequest = {
  page: number;
  pageSize: number;
  filter: string;
  projectGroupId: string;
};

export function postIdentifierPeopleGets(payload: GetPeopleRequest) {
  return idpPostJson<GetPeopleResponse>("/identifier/v1/People/Gets", payload);
}

export function postIdentifierPeopleInvite(payload: InvitePeoplePayload) {
  return idpPostJson<{ isSuccess: boolean; errors: null | { exceed_limit?: string } }>(
    "/identifier/v1/People/Invite",
    payload,
  );
}

export function postIdentifierResendInvitation(payload: ResendInvitationPayload) {
  return idpPostJson<IdentifierMutationResponse>(
    "/identifier/v1/People/ResendInvitation",
    payload,
  );
}

export function postIdentifierTransferOwnership(payload: TransferOwnershipPayload) {
  return idpPostJson<IdentifierMutationResponse>(
    "/identifier/v1/People/TransferOwnerShip",
    payload,
  );
}

export type RemoveEnvironmentAccessPayload = {
  email: string;
  projectKeys: string[];
  groupId: string;
};

/** Same path as monolith `removeEnvironmentAccess` — body shape `{ email, projectKeys, groupId }`. */
export function postIdentifierRemoveEnvironmentAccess(payload: RemoveEnvironmentAccessPayload) {
  return idpPostJson<IdentifierMutationResponse>("/identifier/v1/People/RemoveAccess", payload);
}
