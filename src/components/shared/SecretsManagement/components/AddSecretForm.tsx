import { type ChangeEvent, useReducer } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatDate, parseUTCAsLocalDate, toEndOfDayUTC } from "@/utils/date";

import { isValidSecretValue, type Secret, secretNameProblem } from "../types";
import { AddSecretButton } from "./AddSecretButton";
import { EXPIRY_FORMAT, ExpiryDatePicker } from "./ExpiryDatePicker";
import { UpdateSecretButton } from "./UpdateSecretButton";

interface AddSecretFormState {
  name: string;
  value: string;
  description: string;
  expiresOn: Date | undefined;
  nameError: string | null;
  valueError: string | null;
}

type AddSecretFormAction =
  | { type: "SET_NAME"; payload: string }
  | { type: "SET_VALUE"; payload: string }
  | { type: "SET_DESCRIPTION"; payload: string }
  | { type: "SET_EXPIRES_ON"; payload: Date | undefined }
  | { type: "RESET" };

function formReducer(
  state: AddSecretFormState,
  action: AddSecretFormAction,
): AddSecretFormState {
  switch (action.type) {
    case "SET_NAME": {
      const name = action.payload;
      const nameError = name.length > 0 ? secretNameProblem(name) : null;
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
    case "SET_DESCRIPTION":
      return { ...state, description: action.payload };
    case "SET_EXPIRES_ON":
      return { ...state, expiresOn: action.payload };
    case "RESET":
      return initialFormState;
    default:
      return state;
  }
}

const initialFormState: AddSecretFormState = {
  name: "",
  value: "",
  description: "",
  expiresOn: undefined,
  nameError: null,
  valueError: null,
};

const SECRET_FIELD_MAX_LENGTH = 255;

function describedBy(...ids: (string | false)[]): string | undefined {
  return ids.filter(Boolean).join(" ") || undefined;
}

function FieldLengthLimit({ id, atLimit }: { id: string; atLimit: boolean }) {
  if (!atLimit) return null;
  return (
    <Text id={id} size="xs" tone="subdued">
      {`Up to ${SECRET_FIELD_MAX_LENGTH} characters.`}
    </Text>
  );
}

export function lastWholeSecondOfDayUTC(day: Date): Date {
  const endOfDay = new Date(toEndOfDayUTC(day));
  endOfDay.setUTCMilliseconds(0);
  return endOfDay;
}

function expiryHint(existingSecret?: Secret): string | null {
  if (!existingSecret?.expiresAt) return null;
  const currentExpiry = formatDate(
    parseUTCAsLocalDate(existingSecret.expiresAt.toISOString()),
    EXPIRY_FORMAT,
  );
  return `Currently ${currentExpiry}. Leave empty to keep that date.`;
}

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
  const originalDescription = existingSecret?.description ?? "";
  const [state, dispatch] = useReducer(formReducer, {
    ...initialFormState,
    name: existingSecret?.name ?? "",
    description: originalDescription,
  });

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "SET_NAME", payload: e.target.value });
  };

  const handleValueChange = (e: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "SET_VALUE", payload: e.target.value });
  };

  const handleDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    dispatch({ type: "SET_DESCRIPTION", payload: e.target.value });
  };

  const handleExpiresOnChange = (date: Date | undefined) => {
    dispatch({ type: "SET_EXPIRES_ON", payload: date });
  };

  const isReplace = !!existingSecret;
  const nameAtLimit = state.name.length >= SECRET_FIELD_MAX_LENGTH;
  const descriptionAtLimit =
    state.description.length >= SECRET_FIELD_MAX_LENGTH;

  const isFormValid =
    (isReplace || secretNameProblem(state.name) === null) &&
    isValidSecretValue(state.value) &&
    !state.valueError;

  const trimmedDescription = state.description.trim();
  const description =
    trimmedDescription !== "" && trimmedDescription !== originalDescription
      ? trimmedDescription
      : undefined;
  const expiresAt = state.expiresOn
    ? lastWholeSecondOfDayUTC(state.expiresOn)
    : undefined;
  const currentExpiryHint = expiryHint(existingSecret);

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
          maxLength={SECRET_FIELD_MAX_LENGTH}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!state.nameError}
          aria-describedby={describedBy(nameAtLimit && "secret-name-limit")}
          className={cn(state.nameError && "border-destructive")}
          data-testid="secret-name-input"
        />
        {state.nameError && (
          <Text size="xs" tone="critical">
            {state.nameError}
          </Text>
        )}
        <FieldLengthLimit id="secret-name-limit" atLimit={nameAtLimit} />
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
          autoComplete="new-password"
          spellCheck={false}
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

      <BlockStack gap="2">
        <Label htmlFor="secret-description">Description (optional)</Label>
        <Textarea
          id="secret-description"
          placeholder="What this secret is for"
          value={state.description}
          onChange={handleDescriptionChange}
          maxLength={SECRET_FIELD_MAX_LENGTH}
          aria-describedby={describedBy(
            !!originalDescription && "secret-description-hint",
            descriptionAtLimit && "secret-description-limit",
          )}
          data-testid="secret-description-input"
        />
        {originalDescription && (
          <Text id="secret-description-hint" size="xs" tone="subdued">
            It can be changed but not removed.
          </Text>
        )}
        <FieldLengthLimit
          id="secret-description-limit"
          atLimit={descriptionAtLimit}
        />
      </BlockStack>

      <BlockStack gap="2">
        <Label htmlFor="secret-expiry">Expires (optional)</Label>
        <ExpiryDatePicker
          id="secret-expiry"
          value={state.expiresOn}
          onChange={handleExpiresOnChange}
          describedBy={currentExpiryHint ? "secret-expiry-hint" : undefined}
        />
        {currentExpiryHint && (
          <Text id="secret-expiry-hint" size="xs" tone="subdued">
            {currentExpiryHint}
          </Text>
        )}
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
            secret={{
              id: existingSecret.id,
              value: state.value,
              description,
              expiresAt,
            }}
            disabled={!isFormValid}
            onSuccess={onSuccess}
          />
        ) : (
          <AddSecretButton
            secret={{
              name: state.name.trim(),
              value: state.value,
              description,
              expiresAt,
            }}
            disabled={!isFormValid}
            onSuccess={onSuccess}
          />
        )}
      </InlineStack>
    </BlockStack>
  );
}
