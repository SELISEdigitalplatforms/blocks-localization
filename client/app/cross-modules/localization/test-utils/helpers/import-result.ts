import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__";
import type { IImportFile } from "@blocks-localization/models/language";
import {
  UseMutationResult,
  UseMutateFunction,
  UseMutateAsyncFunction,
} from "@tanstack/react-query";
import { Mock, vi } from "vitest";

export function createIdleImportResult({
  mockMutateAsync,
}: {
  mockMutateAsync: Mock<() => Promise<unknown>>;
}): UseMutationResult<unknown, Error, IImportFile, unknown> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isIdle: true,
    isPending: false,
    isPaused: false,
    isSuccess: false,
    failureCount: 0,
    failureReason: null,
    mutate: vi.fn() as UseMutateFunction<unknown, Error, IImportFile, unknown>,
    mutateAsync: mockMutateAsync as UseMutateAsyncFunction<unknown, Error, IImportFile, unknown>,
    reset: vi.fn(),
    status: "idle" as const,
    submittedAt: 0,
    variables: undefined,
    context: undefined,
  };
}

export function createPendingImportResult({
  mockMutateAsync,
}: {
  mockMutateAsync: Mock<() => Promise<unknown>>;
}): UseMutationResult<unknown, Error, IImportFile, unknown> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isIdle: false,
    isPending: true,
    isPaused: false,
    isSuccess: false,
    failureCount: 0,
    failureReason: null,
    mutate: vi.fn() as UseMutateFunction<unknown, Error, IImportFile, unknown>,
    mutateAsync: mockMutateAsync as UseMutateAsyncFunction<unknown, Error, IImportFile, unknown>,
    reset: vi.fn(),
    status: "pending" as const,
    submittedAt: 0,
    variables: { messageCoRelationId: "", fileId: "", projectKey: TEST_PROJECT_KEY },
    context: undefined,
  };
}
