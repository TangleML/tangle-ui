import { useSyncExternalStore } from "react";

import type { Secret } from "@/components/shared/SecretsManagement/types";

/**
 * In-memory stand-in for the secrets backend, used only while a guided tour
 * runs without a real backend (see TourMockBackendController). It lets the user
 * actually perform the secret steps — add, list, pick, assign — against an
 * ephemeral store that is cleared when the tour ends. Nothing is persisted or
 * sent anywhere.
 *
 * This module is intentionally free of React-provider imports so the leaf
 * `secretsStorage` util can read `isTourMockActive()` without pulling the
 * component/provider tree into its import graph.
 */

let active = false;
const secrets = new Map<string, Secret>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setTourMockActive(value: boolean): void {
  if (active === value) return;
  active = value;
  if (!value) secrets.clear();
  emit();
}

export function isTourMockActive(): boolean {
  return active;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reactively reports whether the tour mock backend is active. */
export function useTourMockBackend(): boolean {
  return useSyncExternalStore(subscribe, isTourMockActive, isTourMockActive);
}

export function mockListSecrets(): Secret[] {
  return Array.from(secrets.values());
}

export function mockAddSecret(name: string, value?: string): void {
  const now = new Date();
  const existing = secrets.get(name);
  secrets.set(name, {
    id: name,
    name,
    value,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export function mockUpdateSecret(name: string, value?: string): void {
  const existing = secrets.get(name);
  if (!existing) return;
  secrets.set(name, { ...existing, value, updatedAt: new Date() });
}

export function mockRemoveSecret(name: string): void {
  secrets.delete(name);
}
