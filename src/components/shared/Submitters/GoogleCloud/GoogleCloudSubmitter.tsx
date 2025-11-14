import { type ChangeEvent, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGoogleCloudSubmitter } from "@/hooks/useGoogleCloudSubmitter";
import type { ComponentSpec } from "@/utils/componentSpec";

import { ConfigInput } from "./ConfigInput";
import { ManualSubmissionInstructions } from "./ManualSubmissionInstructions";
import { RegionInput } from "./RegionInput";

interface GoogleCloudSubmitterProps {
  componentSpec?: ComponentSpec;
}

const GoogleCloudSubmitter = ({ componentSpec }: GoogleCloudSubmitterProps) => {
  const {
    config,
    cloudProjects,
    jsonBlobUrl,
    jobWebUrl,
    isValid,
    updateConfig,
    submit,
    refreshProjectList,
  } = useGoogleCloudSubmitter({
    componentSpec,
  });

  const handleOAuthClientIdChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      updateConfig({ googleCloudOAuthClientId: e.target.value });
    },
    [updateConfig],
  );

  const handleDirectoryInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      updateConfig({ gcsOutputDirectory: e.target.value });
    },
    [updateConfig],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">OAuth Client Id</p>
        <Input
          type="text"
          value={config.googleCloudOAuthClientId}
          onChange={handleOAuthClientIdChange}
          autoFocus={!config.googleCloudOAuthClientId}
        />
      </div>
      <ConfigInput
        config={config}
        projectList={cloudProjects}
        onChange={updateConfig}
        refreshProjectList={refreshProjectList}
      />
      <RegionInput config={config} onChange={updateConfig} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">Output Directory</p>
        <Input
          type="text"
          value={config.gcsOutputDirectory}
          onChange={handleDirectoryInputChange}
          disabled={!config.googleCloudOAuthClientId}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Button onClick={submit} disabled={!isValid}>
          Submit pipeline job
        </Button>
        {jobWebUrl && (
          <a
            href={jobWebUrl}
            target="_blank"
            rel="noreferrer"
            style={{ margin: "5px" }}
          >
            Job
          </a>
        )}
      </div>
      {jsonBlobUrl && (
        <ManualSubmissionInstructions downloadUrl={jsonBlobUrl} />
      )}
    </div>
  );
};

export default GoogleCloudSubmitter;
