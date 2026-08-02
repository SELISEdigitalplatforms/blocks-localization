import { serviceInstances } from "@/lib/http-client";
import {
  IPeopleAcceptInvitationPayload,
  IPeopleAcceptInvitationResponse,
  ITransferOwnershipPayload,
  GetPeopleResponse,
  IConfirmInvitation,
  IInvitePeoplePayload,
  IInvitePeopleResponse,
  IRemoveAccess,
  IRemoveEnvironmentAccess,
  IResendInvitation,
} from "@blocks-identifier/models/people.model";
import { PEOPLE_ENDPOINTS } from "@blocks-identifier/constants/endpoint.constant";

export class PeopleService {
  private readonly httpClient = serviceInstances.logicService;

  peopleAcceptInvitation(
    payload: IPeopleAcceptInvitationPayload,
  ): Promise<IPeopleAcceptInvitationResponse> {
    return this.httpClient.post(PEOPLE_ENDPOINTS.CONFIRM_INVITATION, payload);
  }

  getPeople(payload: {
    page: number;
    pageSize: number;
    filter: string;
    projectGroupId: string;
  }): Promise<GetPeopleResponse> {
    return this.httpClient.post<GetPeopleResponse>(PEOPLE_ENDPOINTS.GETS, payload);
  }

  invitePeople(invitePeoplePayload: IInvitePeoplePayload): Promise<IInvitePeopleResponse> {
    return this.httpClient.post(PEOPLE_ENDPOINTS.INVITE, invitePeoplePayload);
  }

  resendInvitation(resendInvitation: IResendInvitation): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> {
    return this.httpClient.post(PEOPLE_ENDPOINTS.RESEND_INVITATION, resendInvitation);
  }

  removeAccess(removeAccess: IRemoveAccess): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> {
    return this.httpClient.post(PEOPLE_ENDPOINTS.REMOVE_ACCESS, removeAccess);
  }

  removeEnvironmentAccess(payload: IRemoveEnvironmentAccess): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> {
    return this.httpClient.post(PEOPLE_ENDPOINTS.REMOVE_ACCESS, payload);
  }

  confirmInvitation(removeAccess: IConfirmInvitation): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
    activationKey: string;
  }> {
    return this.httpClient.post(PEOPLE_ENDPOINTS.CONFIRM_INVITATION, removeAccess);
  }

  transferOwnership(payload: ITransferOwnershipPayload): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> {
    return this.httpClient.post(PEOPLE_ENDPOINTS.TRANSFER_OWNERSHIP, payload);
  }





}

export const peopleService = new PeopleService();
