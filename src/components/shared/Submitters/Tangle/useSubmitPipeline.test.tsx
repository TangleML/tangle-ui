import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ONBOARDING_MY_RUN_COUNT_KEY } from "@/providers/OnboardingProvider/onboardingQueryKeys";
import { RunSubmissionScopeProvider } from "@/providers/RunSubmissionScopeProvider";
import * as pipelineRunService from "@/services/pipelineRunService";
import { ProjectRunsQueryKeys } from "@/services/projects/types";
import type { PipelineRun } from "@/types/pipelineRun";
import type { ComponentSpec } from "@/utils/componentSpec";
import { SOURCE_PIPELINE_ID_ANNOTATION } from "@/utils/pipelineRunSource";
import { projectRunAnnotationKey } from "@/utils/projectRunAnnotation";

import { useSubmitPipeline } from "./useSubmitPipeline";

vi.mock("@/components/shared/Authentication/helpers", () => ({
  isAuthorizationRequired: () => false,
}));
vi.mock("@/components/shared/Authentication/useAuthLocalStorage", () => ({
  useAuthLocalStorage: () => ({ getToken: () => "test-token" }),
}));
vi.mock("@/components/shared/Authentication/useAwaitAuthorization", () => ({
  useAwaitAuthorization: () => ({ isAuthorized: true }),
}));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: BACKEND }),
}));
vi.mock("@/services/pipelineRunService", () => ({
  createPipelineRun: vi.fn(),
  savePipelineRun: vi.fn(),
}));

const BACKEND = "https://api.example.com";
const SOURCE_ID = "00000000-0000-4000-8000-000000000002";
const SCOPE_PROJECT_ID = "scope-project";
const SELECTED_PROJECT_ID = "selected-project";
const componentSpec: ComponentSpec = {
  name: "Project pipeline",
  implementation: { container: { image: "test:latest" } },
};
const run: PipelineRun = {
  id: 123,
  root_execution_id: 456,
  created_at: "2026-09-30T12:00:00Z",
  created_by: "test-user",
  pipeline_name: "Project pipeline",
};
const refreshedQueryKeys = [
  ["pipelineRuns"],
  ["runs", BACKEND, { sourcePipelineId: SOURCE_ID }],
  ONBOARDING_MY_RUN_COUNT_KEY,
  ProjectRunsQueryKeys.List(SCOPE_PROJECT_ID),
  ProjectRunsQueryKeys.List(SELECTED_PROJECT_ID),
];
const untouchedQueryKeys = [
  ["runs", "https://other.example.com"],
  ProjectRunsQueryKeys.List("other-project"),
];
const clients: QueryClient[] = [];

function renderSubmission() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  clients.push(client);
  for (const queryKey of [...refreshedQueryKeys, ...untouchedQueryKeys]) {
    client.setQueryData(queryKey, []);
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <RunSubmissionScopeProvider projectId={SCOPE_PROJECT_ID}>
        {children}
      </RunSubmissionScopeProvider>
    </QueryClientProvider>
  );
  return { ...renderHook(useSubmitPipeline, { wrapper }), client };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pipelineRunService.createPipelineRun).mockResolvedValue(run);
  vi.mocked(pipelineRunService.savePipelineRun).mockResolvedValue(run);
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

describe("useSubmitPipeline", () => {
  it("keeps project membership and source association together after the first upload", async () => {
    let finishUpload!: (id: string) => void;
    const prepareSourcePipeline = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishUpload = resolve;
        }),
    );
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result, client } = renderSubmission();

    act(() => {
      result.current.mutate({
        componentSpec,
        taskArguments: { dataset: "sample.csv" },
        projectIds: [SELECTED_PROJECT_ID],
        prepareSourcePipeline,
        onSuccess,
        onError,
      });
    });

    await waitFor(() =>
      expect(prepareSourcePipeline).toHaveBeenCalledWith(BACKEND),
    );
    expect(pipelineRunService.createPipelineRun).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();

    act(() => finishUpload(SOURCE_ID));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(pipelineRunService.createPipelineRun).toHaveBeenCalledTimes(1);
    expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
      expect.objectContaining({
        annotations: {
          source: "web-app",
          [SOURCE_PIPELINE_ID_ANNOTATION]: SOURCE_ID,
          [projectRunAnnotationKey(SCOPE_PROJECT_ID)]: "true",
          [projectRunAnnotationKey(SELECTED_PROJECT_ID)]: "true",
        },
        root_task: expect.objectContaining({
          arguments: { dataset: "sample.csv" },
        }),
      }),
      BACKEND,
      "test-token",
    );
    expect(onSuccess).toHaveBeenCalledExactlyOnceWith(run);
    expect(onError).not.toHaveBeenCalled();
    for (const queryKey of refreshedQueryKeys) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
    for (const queryKey of untouchedQueryKeys) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(false);
    }
  });

  it("reports a failed first upload without creating a run or refreshing run lists", async () => {
    const failure = new Error("Upload failed");
    const prepareSourcePipeline = vi.fn().mockRejectedValue(failure);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result, client } = renderSubmission();

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          componentSpec,
          projectIds: [SELECTED_PROJECT_ID],
          prepareSourcePipeline,
          onSuccess,
          onError,
        }),
      ).rejects.toBe(failure);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(prepareSourcePipeline).toHaveBeenCalledWith(BACKEND);
    expect(pipelineRunService.createPipelineRun).not.toHaveBeenCalled();
    expect(pipelineRunService.savePipelineRun).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    for (const queryKey of refreshedQueryKeys) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(false);
    }
  });
});
