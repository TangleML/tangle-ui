import { type ChangeEvent, useReducer } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { isValidSecretName, isValidSecretValue, type Secret } from "../types";
import { AddSecretButton } from "./AddSecretButton";
import { UpdateSecretButton } from "./UpdateSecretButton";

interface AddSecretFormState {
  name: string;
  value: string;
  nameError: string | null;
  valueError: string | null;
}

type AddSecretFormAction =
  | { type: "SET_NAME"; payload: string }
  | { type: "SET_VALUE"; payload: string }
  | { type: "RESET" };

function formReducer(
  state: AddSecretFormState,
  action: AddSecretFormAction,
): AddSecretFormState {
  switch (action.type) {
    case "SET_NAME": {
      const name = action.payload;
      const nameError =
        name.length > 0 && !isValidSecretName(name)
          ? "Secret name cannot be empty"
          : null;
      return { ...state, name, nameError };
    }
    case "SET_VALUE": {
      const value = action.payload;
      const valueError =
        value.length > 0 && !isValidSecretValue(value)
          ? "Secret value cannot be empty"
          : null;
      return { ...state, value, valueError };
    }
    case "RESET":
      return initialFormState;
    default:
      return state;
  }
}

const initialFormState: AddSecretFormState = {
  name: "",
  value: "",
  nameError: null,
  valueError: null,
};

interface AddSecretFormProps {
  existingSecret?: Secret;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddSecretForm({
  existingSecret,
  onSuccess,
  onCancel,
}: AddSecretFormProps) {
  const [state, dispatch] = useReducer(formReducer, {
    ...initialFormState,
    name: existingSecret?.name ?? "",
    value: "",
  });

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "SET_NAME", payload: e.target.value });
  };

  const handleValueChange = (e: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "SET_VALUE", payload: e.target.value });
  };

  const isFormValid =
    isValidSecretName(state.name) &&
    isValidSecretValue(state.value) &&
    !state.nameError &&
    !state.valueError;

  const isReplace = !!existingSecret;

  return (
    <BlockStack gap="4">
      <BlockStack gap="2">
        <Label htmlFor="secret-name">Secret Name</Label>
        <Input
          id="secret-name"
          placeholder="e.g., API_KEY"
          value={state.name}
          onChange={handleNameChange}
          disabled={isReplace}
          aria-invalid={!!state.nameError}
          className={cn(state.nameError && "border-destructive")}
          data-testid="secret-name-input"
        />
        {state.nameError && (
          <Text size="xs" tone="critical">
            {state.nameError}
          </Text>
        )}
      </BlockStack>

      <BlockStack gap="2">
        <Label htmlFor="secret-value">
          {isReplace ? "New Secret Value" : "Secret Value"}
        </Label>
        <Input
          id="secret-value"
          type="password"
          placeholder="Enter secret value..."
          value={state.value}
          onChange={handleValueChange}
          aria-invalid={!!state.valueError}
          className={cn(state.valueError && "border-destructive")}
          data-testid="secret-value-input"
        />
        {state.valueError && (
          <Text size="xs" tone="critical">
            {state.valueError}
          </Text>
        )}
        <Text size="xs" tone="subdued">
          The secret value is stored securely and never displayed.
        </Text>
      </BlockStack>

      <InlineStack gap="2" align="end" fill>
        <Button
          variant="outline"
          onClick={onCancel}
          data-testid="secret-form-cancel-button"
        >
          Cancel
        </Button>
        {existingSecret ? (
          <UpdateSecretButton
            secret={{ id: existingSecret.id, value: state.value }}
            disabled={!isFormValid}
            onSuccess={onSuccess}
          />
        ) : (
          <AddSecretButton
            secret={{ name: state.name.trim(), value: state.value }}
            disabled={!isFormValid}
            onSuccess={onSuccess}
          />
        )}
      </InlineStack>
    </BlockStack>
  );
}
