import type { AccessUsers } from "./accessControlApi";

export interface AccessRow {
  email: string;
  permissions: string[];
}

export function rowsFromUsers(users: AccessUsers): AccessRow[] {
  return Object.entries(users)
    .map(([email, { permissions }]) => ({ email, permissions }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export function usersFromRows(rows: AccessRow[]): AccessUsers {
  return Object.fromEntries(
    rows.map(({ email, permissions }) => [
      email.trim().toLowerCase(),
      { permissions },
    ]),
  );
}

export function addRow(
  rows: AccessRow[],
  email: string,
  permission: string,
): AccessRow[] {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return rows;
  return [
    ...rows.filter((row) => row.email !== normalized),
    { email: normalized, permissions: [permission] },
  ];
}
