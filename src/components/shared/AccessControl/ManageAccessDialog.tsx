import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paragraph, Text } from "@/components/ui/typography";
import { useUserDetails } from "@/hooks/useUserDetails";

import {
  AccessControlApiError,
  BROAD_SCOPES,
  getAccessControl,
  type ResourceType,
  updateAccessControl,
} from "./accessControlApi";
import {
  type AccessRow,
  addRow,
  rowsFromUsers,
  usersFromRows,
} from "./accessUsers";

interface ManageAccessDialogProps {
  type: ResourceType;
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PermissionSelect({
  value,
  disabled,
  onChange,
}: {
  value: string[];
  disabled: boolean;
  onChange: (permissions: string[]) => void;
}) {
  const joined = value.join(", ");
  const isBroad =
    value.length === 1 && BROAD_SCOPES.some((s) => s === value[0]);

  return (
    <Select
      value={joined}
      disabled={disabled}
      onValueChange={(next) => onChange(next.split(", "))}
    >
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BROAD_SCOPES.map((scope) => (
          <SelectItem key={scope} value={scope}>
            {scope}
          </SelectItem>
        ))}
        {!isBroad && <SelectItem value={joined}>{joined}</SelectItem>}
      </SelectContent>
    </Select>
  );
}

export function ManageAccessDialog({
  type,
  id,
  open,
  onOpenChange,
}: ManageAccessDialogProps) {
  const queryClient = useQueryClient();
  const { data: currentUser } = useUserDetails();
  const queryKey = ["access_control", type, id];
  const { data, error, isLoading } = useQuery({
    queryKey,
    queryFn: () => getAccessControl(type, id),
    enabled: open,
    retry: false,
  });
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newPermission, setNewPermission] = useState<string>("operate");

  useEffect(() => {
    if (data) setRows(rowsFromUsers(data.users));
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      updateAccessControl(type, id, {
        users: usersFromRows(rows),
        revision: data?.revision ?? 0,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      onOpenChange(false);
    },
    onError: (saveError) => {
      if (
        saveError instanceof AccessControlApiError &&
        saveError.status === 409
      ) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const canShare = !!data?.my_scopes.includes(`${type}:share`);
  const isOwner =
    !!data?.owner &&
    currentUser?.id?.toLowerCase() === data.owner.toLowerCase();
  const showSecretsTip =
    type === "pipeline" &&
    !!data?.owner &&
    !isOwner &&
    data.my_scopes.includes("pipeline:update");
  const shownError = (save.error ?? error) as Error | null;

  const updateRow = (email: string, permissions: string[]) =>
    setRows((current) =>
      current.map((row) =>
        row.email === email ? { ...row, permissions } : row,
      ),
    );

  const handleAdd = () => {
    setRows((current) => addRow(current, newEmail, newPermission));
    setNewEmail("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage access</DialogTitle>
          <DialogDescription>
            Owned by {data?.owner ?? "unknown"}. Operate runs and cancels, edit
            also changes the {type} except secrets, manage also deletes and
            shares it.
          </DialogDescription>
        </DialogHeader>

        <BlockStack gap="3">
          {showSecretsTip && (
            <InlineStack gap="2" blockAlign="center" wrap="nowrap">
              <Icon name="Lock" size="sm" className="text-blue-700" />
              <Text size="sm" tone="subdued">
                Ask {data.owner} to add or change secrets.
              </Text>
            </InlineStack>
          )}
          {!!data?.warning && (
            <InfoBox title="Edit means trust" variant="info">
              {data.warning}
            </InfoBox>
          )}
          {!!shownError && (
            <InfoBox title="Could not update access" variant="error">
              {shownError.message}
            </InfoBox>
          )}
          {isLoading && <Paragraph size="sm">Loading…</Paragraph>}
          {!isLoading && rows.length === 0 && (
            <Paragraph size="sm" tone="subdued">
              Not shared with anyone.
            </Paragraph>
          )}
          {rows.map((row) => (
            <InlineStack
              key={row.email}
              gap="2"
              blockAlign="center"
              wrap="nowrap"
            >
              <Text size="sm" className="flex-1 truncate">
                {row.email}
              </Text>
              <PermissionSelect
                value={row.permissions}
                disabled={!canShare}
                onChange={(permissions) => updateRow(row.email, permissions)}
              />
              {canShare && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${row.email}`}
                  onClick={() =>
                    setRows((current) =>
                      current.filter(({ email }) => email !== row.email),
                    )
                  }
                >
                  <Icon name="Trash2" />
                </Button>
              )}
            </InlineStack>
          ))}
          {canShare && (
            <InlineStack gap="2" blockAlign="center" wrap="nowrap">
              <Input
                value={newEmail}
                placeholder="name@example.com"
                onChange={(e) => setNewEmail(e.target.value)}
                onEnter={handleAdd}
              />
              <PermissionSelect
                value={[newPermission]}
                disabled={false}
                onChange={([permission]) => setNewPermission(permission)}
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Add user"
                disabled={!newEmail.trim()}
                onClick={handleAdd}
              >
                <Icon name="Plus" />
              </Button>
            </InlineStack>
          )}
        </BlockStack>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {canShare && (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
