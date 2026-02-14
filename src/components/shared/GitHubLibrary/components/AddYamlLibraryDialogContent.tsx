import { useMutation } from "@tanstack/react-query";
import { useReducer, useState } from "react";

import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Paragraph, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { fetchWithCache } from "@/providers/ComponentLibraryProvider/libraries/utils";
import { isValidComponentLibrary } from "@/types/componentLibrary";
import { loadObjectFromYamlData } from "@/utils/cache";

import { ensureYamlLibrary } from "../utils/ensureYamlLibrary";
import { validatePAT } from "../utils/validatePAT";
import { InputField } from "./InputField";

export const AddYamlLibraryDialogContent = ({
  onOkClick,
}: {
  onOkClick: () => void;
}) => {
  return (
    <BlockStack gap="2">
      <ConfigureImport onSuccess={onOkClick} />
    </BlockStack>
  );
};

interface YamlLibraryProcessState {
  yamlUrl: string;
  accessToken: string;
  hasErrors: boolean;
}

type YamlLibraryFormAction = {
  type: "UPDATE";
  payload: Partial<Omit<YamlLibraryProcessState, "hasErrors">>;
};

function addGithubLibraryReducer(
  state: YamlLibraryProcessState,
  action: YamlLibraryFormAction,
): YamlLibraryProcessState {
  switch (action.type) {
    case "UPDATE": {
      const newState = { ...state, ...action.payload };
      return {
        ...newState,
        hasErrors: !isStateValid(newState),
      };
    }
    default:
      return state;
  }
}

function isStateValid(state: YamlLibraryProcessState): boolean {
  return (
    !validateYamlUrl(state.yamlUrl)?.length &&
    (!state.accessToken || !validatePAT(state.accessToken)?.length)
  );
}

function validateYamlUrl(url: string): string[] | null {
  if (!url) return ["YAML URL is required"];
  // todo: add more validation for YAML URL
  return url.startsWith("http")
    ? null
    : ["Invalid YAML URL. Must start with http"];
}

function ConfigureImport({ onSuccess }: { onSuccess: () => void }) {
  const notify = useToastNotification();

  const initialState: YamlLibraryProcessState = {
    yamlUrl: "",
    accessToken: "",
    hasErrors: true,
  };

  const [state, dispatch] = useReducer(addGithubLibraryReducer, initialState);
  const [processError, setProcessError] = useState<string | null>(null);

  const { mutate: importYamlLibrary, isPending } = useMutation({
    mutationFn: async (state: YamlLibraryProcessState) => {
      const response = await fetchWithCache(state.yamlUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${state.yamlUrl}: ${response.status}`);
      }

      const data = await response.arrayBuffer();

      const yamlData = loadObjectFromYamlData(data);

      if (!isValidComponentLibrary(yamlData)) {
        throw new Error(`Invalid component library: ${state.yamlUrl}`);
      }

      const name =
        (yamlData.annotations?.name as string) ??
        state.yamlUrl.split("/").pop()?.split(".")[0] ??
        "YAML Library";

      await ensureYamlLibrary({
        name,
        yamlUrl: state.yamlUrl,
        accessToken: state.accessToken,
      });

      return yamlData;
    },
    onSuccess: () => {
      notify(`Successfully fetched library`, "success");
      onSuccess();
    },
    onError: (error) => {
      notify(`Error importing YAML library: ${error.message}`, "error");
      setProcessError(error.message);
    },
  });

  const handleSubmit = async () => {
    if (state.hasErrors) {
      notify("Please fill in all fields", "error");
      return;
    }

    setProcessError(null);

    await importYamlLibrary(state);
  };

  return (
    <BlockStack
      gap="4"
      className={cn(isPending && "pointer-events-none opacity-50")}
    >
      <Paragraph tone="subdued" size="xs">
        You can use a Personal Access Token to access private repositories.
        Connect a YAML file to import components from your library.
      </Paragraph>
      {processError && (
        <Text size="xs" tone="critical">
          {processError}
        </Text>
      )}
      <InputField
        id="yaml-url"
        label="YAML URL"
        placeholder="https://example.com/library.yaml"
        value={state.yamlUrl}
        validate={validateYamlUrl}
        onChange={(value) => {
          dispatch({ type: "UPDATE", payload: { yamlUrl: value ?? "" } });
        }}
      />
      <InputField
        id="pat"
        label="Personal Access Token"
        placeholder="ghp_..."
        value={state.accessToken}
        validate={validatePAT}
        onChange={(value) => {
          dispatch({ type: "UPDATE", payload: { accessToken: value ?? "" } });
        }}
      />

      <InlineStack gap="2" className="w-full" align="end">
        <Button
          type="button"
          disabled={state.hasErrors || isPending}
          onClick={handleSubmit}
        >
          Add Library {isPending && <Spinner />}
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
