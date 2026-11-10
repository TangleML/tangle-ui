import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

import { PickerOption } from "@/components/Project/PickerOption";
import { PickerSearchField } from "@/components/Project/PickerSearchField";
import { InfoBox } from "@/components/shared/InfoBox";
import { secretsListQuery } from "@/components/shared/SecretsManagement/secretsStorage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/appRoutes";
import { formatRelativeTime } from "@/utils/date";
import { getErrorMessage } from "@/utils/string";
import { tracking } from "@/utils/tracking";

interface SecretOptionsProps {
  query: string;
  picked: string | null;
  onPick: (name: string) => void;
}

function SecretOptions({ query, picked, onPick }: SecretOptionsProps) {
  const { data: secrets, error, isPending } = useQuery(secretsListQuery());

  if (isPending) {
    return (
      <BlockStack align="center" className="py-6">
        <Spinner />
      </BlockStack>
    );
  }

  if (error) {
    return (
      <InfoBox title="Couldn't load your secrets" variant="error">
        {getErrorMessage(error)}
      </InfoBox>
    );
  }

  if (secrets.length === 0) {
    return (
      <EmptyState
        icon="KeyRound"
        title="You have no secrets yet"
        description={
          <>
            Save your GitHub token in{" "}
            <Link to={APP_ROUTES.SETTINGS_SECRETS} className="underline">
              Settings → Secrets
            </Link>{" "}
            first.
          </>
        }
        placement="start"
      />
    );
  }

  const needle = query.trim().toLowerCase();
  const matching = secrets.filter((secret) =>
    secret.name.toLowerCase().includes(needle),
  );

  if (matching.length === 0) {
    return (
      <Text size="sm" tone="subdued" className="py-4 text-center">
        No secrets match “{query.trim()}”.
      </Text>
    );
  }

  return (
    <BlockStack gap="1" className="min-h-0 overflow-y-auto">
      {matching.map((secret) => (
        <PickerOption
          key={secret.id}
          icon="KeyRound"
          label={secret.name}
          detail={`Added ${formatRelativeTime(secret.createdAt)}`}
          isSelected={picked === secret.name}
          onClick={() => onPick(secret.name)}
          trackingId="settings.github.token_secret_option"
        />
      ))}
    </BlockStack>
  );
}

interface ChooseTokenSecretDialogProps {
  currentSecretName: string | null;
  isSaving: boolean;
  onConfirm: (secretName: string) => void;
  onDismiss: () => void;
}

export function ChooseTokenSecretDialog({
  currentSecretName,
  isSaving,
  onConfirm,
  onDismiss,
}: ChooseTokenSecretDialogProps) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(currentSecretName);

  const canConfirm = picked !== null && picked !== currentSecretName;

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    if (canConfirm && !isSaving) onConfirm(picked);
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onDismiss())}>
      <DialogContent className="flex max-h-[85vh] flex-col">
        <DialogHeader>
          <DialogTitle>Choose your GitHub token</DialogTitle>
          <DialogDescription>
            Pick the secret that holds your GitHub token.
          </DialogDescription>
        </DialogHeader>

        <PickerSearchField
          label="Search secrets"
          value={query}
          onChange={setQuery}
        />

        <SecretOptions query={query} picked={picked} onPick={setPicked} />

        <form onSubmit={confirm}>
          <DialogFooter className="w-full">
            <InlineStack gap="2" className="w-full" align="end">
              <Button
                type="button"
                variant="outline"
                onClick={onDismiss}
                {...tracking("settings.github.token_secret_cancel")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canConfirm || isSaving}
                {...tracking("settings.github.token_secret_confirm", {
                  replaced: currentSecretName !== null,
                })}
              >
                Confirm
              </Button>
            </InlineStack>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
