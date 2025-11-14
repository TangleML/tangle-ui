import { useCallback } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type GoogleCloudSubmitterConfiguration } from "@/hooks/useGoogleCloudSubmitter";

const VERTEX_AI_PIPELINES_REGIONS = [
  "us-central1",
  "us-east1",
  "us-west1",
  "europe-west1",
  "europe-west2",
  "europe-west4",
  "asia-east1",
  "asia-southeast1",
  "northamerica-northeast1",
];

interface RegionInputProps {
  config: GoogleCloudSubmitterConfiguration;
  onChange: (config: Partial<GoogleCloudSubmitterConfiguration>) => void;
}

export const RegionInput = ({ config, onChange }: RegionInputProps) => {
  const handleSelectChange = useCallback(
    (value: string) => {
      onChange({ region: value });
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold">Region</p>
      <Select
        onValueChange={handleSelectChange}
        value={config.region}
        disabled={!config.googleCloudOAuthClientId}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Region" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>GCS Regions</SelectLabel>
            {VERTEX_AI_PIPELINES_REGIONS.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};
