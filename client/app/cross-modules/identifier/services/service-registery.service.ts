import { serviceInstances } from "@/lib/http-client";
import {
  IRegisterServicePayload,
  IRegisterServiceResponse,
  IGetAllServicesPayload,
  IGetAllServicesResponse,
} from "../types/services.type";
import { SERVICE_REGISTRY_ENDPOINTS } from "@blocks-identifier/constants/endpoint.constant";

export class ServiceRegistryService {
  private readonly httpClient = serviceInstances.logicService;

  registerService(payload: IRegisterServicePayload): Promise<IRegisterServiceResponse> {
    return this.httpClient.post(SERVICE_REGISTRY_ENDPOINTS.REGISTER, payload);
  }

  getAllServices(payload: IGetAllServicesPayload): Promise<IGetAllServicesResponse> {
    return this.httpClient.post(SERVICE_REGISTRY_ENDPOINTS.GET_ALL, payload);
  }
}

export const serviceRegistryService = new ServiceRegistryService();
