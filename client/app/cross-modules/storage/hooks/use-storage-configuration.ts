import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { storageService } from "../services/storage.service";
import { useProjectStore } from "@seliseblocks/genesis-os";
import {
  IStorageConfigurationDeletePayload,
  IStorageConfigurationSavePayload,
} from "../models/storage.model";

export const useGetStorageConfigurations = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["storage", "configuration", "gets", tenantId],
    queryFn: () => storageService.configuration.gets(tenantId),
  });
};

export const useSaveStorageConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["storage", "configuration", "save"],
    mutationFn: (payload: IStorageConfigurationSavePayload) =>
      storageService.configuration.save(payload),
    onSuccess: (data) => {
      if (data.isSuccess)
        queryClient.invalidateQueries({
          queryKey: ["storage", "configuration", "gets"],
        });
    },
  });
};

export const useDeleteStorageConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["storage", "configuration", "delete"],
    mutationFn: (payload: IStorageConfigurationDeletePayload) =>
      storageService.configuration.delete(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["storage", "configuration", "gets"],
      });
    },
  });
};
