/// <reference types="gapi" />
/* global gapi */

import { useEffect, useEffectEvent, useState } from "react";

import { getAppSettings } from "@/appSettings";
import { buildVertexPipelineJobFromGraphComponent } from "@/components/shared/Submitters/GoogleCloud/compiler/vertexAiCompiler";
import type { PipelineJob } from "@/components/shared/Submitters/GoogleCloud/compiler/vertexPipelineSpec";
import type { ComponentSpec } from "@/utils/componentSpec";

import useToastNotification from "./useToastNotification";

const LOCAL_STORAGE_GCS_OUTPUT_DIRECTORY_KEY =
  "GoogleCloudSubmitter/gcsOutputDirectory";
const LOCAL_STORAGE_PROJECT_ID_KEY = "GoogleCloudSubmitter/projectId";
const LOCAL_STORAGE_REGION_KEY = "GoogleCloudSubmitter/region";
const LOCAL_STORAGE_PROJECT_IDS_KEY = "GoogleCloudSubmitter/projectIds";

const VERTEX_AI_PIPELINES_DEFAULT_REGION = "us-central1";

interface useGoogleCloudSubmitterProps {
  componentSpec?: ComponentSpec;
}

export type GoogleCloudSubmitterConfiguration = {
  projectId: string;
  region: string;
  gcsOutputDirectory: string;
  googleCloudOAuthClientId: string;
};

export const useGoogleCloudSubmitter = ({
  componentSpec,
}: useGoogleCloudSubmitterProps) => {
  const notify = useToastNotification();

  const { projects: initialCloudProjects, ...localConfig } =
    getConfigFromLocalStorage();

  const [config, setConfig] =
    useState<GoogleCloudSubmitterConfiguration>(localConfig);

  const [cloudProjects, setCloudProjects] =
    useState<string[]>(initialCloudProjects);

  const [vertexPipelineJob, setVertexPipelineJob] = useState<PipelineJob>();
  const [jobWebUrl, setJobWebUrl] = useState<string>();
  const [jsonBlobUrl, setJsonBlobUrl] = useState<string>();

  const [error, setError] = useState<string>();

  const argumentInputs =
    componentSpec?.inputs?.map((input) => ({
      key: input.name,
      value: "",
      initialValue: "",
      inputSpec: input,
      isRemoved: false,
    })) ?? [];

  const pipelineArguments = new Map(
    argumentInputs
      .filter((arg) => typeof arg.value === "string")
      .map((arg) => [arg.key, arg.value as string]),
  );

  const isValid =
    !!config.projectId &&
    !!config.region &&
    !!config.gcsOutputDirectory &&
    !!config.googleCloudOAuthClientId &&
    vertexPipelineJob !== undefined;

  const updateConfig = (
    configPartial: Partial<GoogleCloudSubmitterConfiguration>,
  ) => {
    setConfig((prevConfig) => ({
      ...prevConfig,
      ...configPartial,
    }));
  };

  const refreshProjectList = async () => {
    try {
      const result = await cloudresourcemanagerListProjects(
        config.googleCloudOAuthClientId,
      );
      const projectIds = (result.projects as any[]).map<string>(
        (projectInfo) => projectInfo.projectId,
      );
      setCloudProjects(projectIds);
      setError(undefined);
      try {
        window.localStorage?.setItem(
          LOCAL_STORAGE_PROJECT_IDS_KEY,
          JSON.stringify(projectIds),
        );
      } catch (err) {
        console.error(
          "GoogleCloudSubmitter: Error writing properties to the localStorage",
          err,
        );
      }
      (window as any).gtag?.("event", "GoogleCloud_list_projects", {
        result: "succeeded",
      });
    } catch (err: any) {
      console.error(err);
      const message = err?.result?.error?.message ?? "Error";
      setError(message);
      notify(message, "error");
      (window as any).gtag?.("event", "GoogleCloud_list_projects", {
        result: "failed",
      });
    }
  };

  const submit = async () => {
    if (vertexPipelineJob === undefined) {
      return;
    }
    try {
      // setItem might throw exception on iOS in incognito mode
      try {
        window.localStorage?.setItem(
          LOCAL_STORAGE_GCS_OUTPUT_DIRECTORY_KEY,
          config.gcsOutputDirectory,
        );
        window.localStorage?.setItem(
          LOCAL_STORAGE_PROJECT_ID_KEY,
          config.projectId,
        );
        window.localStorage?.setItem(LOCAL_STORAGE_REGION_KEY, config.region);
      } catch (err) {
        console.error(
          "GoogleCloudSubmitter: Error writing properties to the localStorage",
          err,
        );
      }
      const displayName = (
        (componentSpec?.name ?? "Pipeline") +
        " " +
        new Date().toISOString().replace("T", " ").replace("Z", "")
      ).substring(0, 127);
      const desiredPipelineJobId = displayName
        .toLowerCase()
        .replace(/[^-a-z0-9]/g, "-")
        .replace(/^-+/, ""); // No leading dashes
      const pipelineJobWithDisplayName = {
        ...vertexPipelineJob,
        displayName,
      };
      const result = await aiplatformCreatePipelineJob(
        config.projectId,
        config.region,
        pipelineJobWithDisplayName,
        config.googleCloudOAuthClientId,
        desiredPipelineJobId,
      );
      const pipelineJobName: string = result.name;
      const pipelineJobId = pipelineJobName.split("/").slice(-1)[0];
      const pipelineJobWebUrl = `https://console.cloud.google.com/vertex-ai/locations/${config.region}/pipelines/runs/${pipelineJobId}?project=${config.projectId}`;
      setJobWebUrl(pipelineJobWebUrl);
      setError(undefined);
    } catch (err: any) {
      console.error(err);
      const message = err?.result?.error?.message ?? "Error";
      setError(message);
      notify(message, "error");
      (window as any).gtag?.("event", "GoogleCloud_submit_pipeline_job", {
        result: "failed",
      });
    }
  };

  const updatePipelineJob = useEffectEvent(
    (job: PipelineJob, jsonUrl: string) => {
      setError(undefined);
      setVertexPipelineJob(job);
      setJsonBlobUrl(jsonUrl);
    },
  );

  const updateErrorState = useEffectEvent((errorMessage: string) => {
    setError(errorMessage);
  });

  useEffect(() => {
    if (componentSpec !== undefined) {
      try {
        const newVertexPipelineJob = buildVertexPipelineJobFromGraphComponent(
          componentSpec,
          config.gcsOutputDirectory,
          pipelineArguments,
        );
        newVertexPipelineJob.labels = {
          sdk: "cloud-pipelines-editor",
          "cloud-pipelines-editor-version": "0-0-1",
        };
        const vertexPipelineJobJson = JSON.stringify(
          vertexPipelineJob,
          undefined,
          2,
        );
        const vertexPipelineJsonBlobUrl = URL.createObjectURL(
          new Blob([vertexPipelineJobJson], { type: "application/json" }),
        );
        updatePipelineJob(newVertexPipelineJob, vertexPipelineJsonBlobUrl);
      } catch (err) {
        const message =
          typeof err === "object" && err instanceof Error
            ? err.toString()
            : String(err);
        updateErrorState(message);
        notify(message, "error");
        updatePipelineJob(undefined as any, undefined as any);
      }
    }
    return () => {
      if (jsonBlobUrl) {
        URL.revokeObjectURL(jsonBlobUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentSpec, pipelineArguments, config.gcsOutputDirectory]);

  return {
    config,
    cloudProjects,
    jsonBlobUrl,
    jobWebUrl,
    error,
    isValid,
    updateConfig,
    submit,
    refreshProjectList,
  };
};

const getConfigFromLocalStorage = () => {
  const appSettings = getAppSettings();
  return {
    projects: JSON.parse(
      window.localStorage?.getItem(LOCAL_STORAGE_PROJECT_IDS_KEY) ?? "[]",
    ),
    projectId: window.localStorage?.getItem(LOCAL_STORAGE_PROJECT_ID_KEY) ?? "",
    region:
      window.localStorage?.getItem(LOCAL_STORAGE_REGION_KEY) ??
      VERTEX_AI_PIPELINES_DEFAULT_REGION,
    gcsOutputDirectory:
      window.localStorage?.getItem(LOCAL_STORAGE_GCS_OUTPUT_DIRECTORY_KEY) ??
      "",
    googleCloudOAuthClientId: appSettings.googleCloudOAuthClientId,
  };
};

const authorizeGoogleCloudClient = async (
  clientId: string,
  scopes: string[],
  immediate = false, // Setting immediate to true prevents auth window showing every time. But it needs to be false the first time (when cookies are not set).
) => {
  return new Promise<GoogleApiOAuth2TokenObject>((resolve, reject) => {
    gapi.auth.authorize(
      {
        client_id: clientId,
        scope: scopes,
        immediate: immediate,
      },
      (authResult) => {
        // console.debug("authorizeGoogleCloudClient: called back");
        if (authResult === undefined) {
          console.error("authorizeGoogleCloudClient failed");
          reject("gapi.auth.authorize result is undefined");
        } else if (authResult.error) {
          console.error("authorizeGoogleCloudClient failed", authResult.error);
          reject(authResult.error);
        } else {
          // console.debug("authorizeGoogleCloudClient: Success");
          // Working around the Google Auth bug: The request succeeds, but the returned token does not have the requested scopes.
          // See https://github.com/google/google-api-javascript-client/issues/743
          const receivedScopesString = (authResult as any).scope as
            | string
            | undefined;
          const receivedScopes = receivedScopesString?.split(" ");
          if (
            receivedScopes === undefined ||
            !scopes.every((scope) => receivedScopes.includes(scope))
          ) {
            const errorMessage = `Authorization call succeeded, but the returned scopes are ${receivedScopesString}`;
            console.error(errorMessage);
            reject(errorMessage);
          } else {
            resolve(authResult);
          }
        }
      },
    );
  });
};

const ensureGoogleCloudAuthorizesScopes = async (
  googleCloudOAuthClientId: string,
  scopes: string[],
) => {
  async function authorizeWithImmediateFlag(immediate: boolean) {
    try {
      const oauthToken = await authorizeGoogleCloudClient(
        googleCloudOAuthClientId,
        scopes,
        immediate,
      );
      (window as any).gtag?.("event", "GoogleCloud_auth", {
        result: "succeeded",
        immediate: immediate.toString(),
      });
      return { success: true, token: oauthToken };
    } catch (error) {
      console.debug(`Authorization failed with immediate=${immediate}`, error);
      return { success: false, token: null }; // Return token as null on failure
    }
  }
  async function handleAuthorization() {
    let oauthToken = await authorizeWithImmediateFlag(true);
    if (!oauthToken.success) {
      // try with different flag
      oauthToken = await authorizeWithImmediateFlag(false);
    }
    if (!oauthToken.success) {
      (window as any).gtag?.("event", "GoogleCloud_auth", {
        result: "failed",
        immediate: "false",
      });
      return false;
    }
    return oauthToken.token;
  }

  return await handleAuthorization();
};

const cloudresourcemanagerListProjects = async (
  googleCloudOAuthClientId: string,
) => {
  await ensureGoogleCloudAuthorizesScopes(googleCloudOAuthClientId, [
    "https://www.googleapis.com/auth/cloud-platform",
  ]);
  const response = await gapi.client.request({
    path: "https://cloudresourcemanager.googleapis.com/v1/projects/",
  });
  return response.result;
};

const aiplatformCreatePipelineJob = async (
  projectId: string,
  region = "us-central1",
  pipelineJob: Record<string, any>,
  googleCloudOAuthClientId: string,
  pipelineJobId?: string,
) => {
  await ensureGoogleCloudAuthorizesScopes(googleCloudOAuthClientId, [
    "https://www.googleapis.com/auth/cloud-platform",
  ]);
  const response = await gapi.client.request({
    path: `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${region}/pipelineJobs?pipelineJobId=${pipelineJobId}`,
    method: "POST",
    body: JSON.stringify(pipelineJob),
  });
  (window as any).gtag?.("event", "GoogleCloud_submit_pipeline_job", {
    result: "succeeded",
  });
  return response.result;
};
