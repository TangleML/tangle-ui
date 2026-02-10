import type { Secret } from "./types";

/**
 * In-memory mocked storage for secrets.
 * This will be replaced with an async API storage layer later.
 */

// In-memory storage
const secretsStore = new Map<string, Secret>();

// Subscribers for reactive updates
type Subscriber = () => void;
const subscribers = new Set<Subscriber>();

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

/**
 * Generates a unique ID for a new secret.
 */
function generateId(): string {
  return `secret_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Gets all secrets from the store.
 * Returns a promise to simulate async API behavior.
 */
export async function getSecrets(): Promise<Secret[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 50));
  return Array.from(secretsStore.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

/**
 * Adds a new secret to the store.
 */
export async function addSecret(name: string, value: string): Promise<Secret> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Check for duplicate names
  const existing = Array.from(secretsStore.values()).find(
    (s) => s.name === name,
  );
  if (existing) {
    throw new Error(`A secret with name "${name}" already exists`);
  }

  const secret: Secret = {
    id: generateId(),
    name,
    value,
    createdAt: new Date(),
  };

  secretsStore.set(secret.id, secret);
  notifySubscribers();

  return secret;
}

/**
 * Updates an existing secret.
 */
export async function updateSecret(
  id: string,
  updates: Partial<Pick<Secret, "name" | "value">>,
): Promise<Secret> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  const existing = secretsStore.get(id);
  if (!existing) {
    throw new Error(`Secret with id "${id}" not found`);
  }

  // Check for name conflicts if name is being updated
  if (updates.name && updates.name !== existing.name) {
    const nameConflict = Array.from(secretsStore.values()).find(
      (s) => s.name === updates.name && s.id !== id,
    );
    if (nameConflict) {
      throw new Error(`A secret with name "${updates.name}" already exists`);
    }
  }

  const updated: Secret = {
    ...existing,
    ...updates,
  };

  secretsStore.set(id, updated);
  notifySubscribers();

  return updated;
}

/**
 * Removes a secret from the store.
 */
export async function removeSecret(id: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (!secretsStore.has(id)) {
    throw new Error(`Secret with id "${id}" not found`);
  }

  secretsStore.delete(id);
  notifySubscribers();
}

/**
 * Query keys for React Query.
 */
export const SecretsQueryKeys = {
  All: () => ["secrets"] as const,
  Id: (id: string) => ["secrets", id] as const,
} as const;
