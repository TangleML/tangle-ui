import type { ComponentReference } from "@/utils/componentSpec";

const MAX_ENTRIES = 200;

/**
 * Holds what `search_components` found so `add_task` can be given an id
 * instead of a component.
 *
 * A reference the model has to repeat back cannot survive the round trip:
 * strict tool schemas close every object, so any part of a spec the schema does
 * not name is unsendable — and a registry component is exactly the case where
 * the shape is not ours to enumerate. Passing an id also keeps a spec that can
 * run to tens of thousands of characters out of the conversation.
 *
 * It outlives a turn: a search and the task it leads to are often two
 * directives apart.
 */
export interface ComponentCatalog {
  remember(id: string, reference: ComponentReference): void;
  lookup(id: string): ComponentReference | undefined;
  size(): number;
}

export function createComponentCatalog(): ComponentCatalog {
  const entries = new Map<string, ComponentReference>();

  return {
    remember(id, reference) {
      // Re-insert so a component searched for again is among the most recent,
      // and drop from the other end rather than evicting what is in use.
      entries.delete(id);
      entries.set(id, reference);
      for (const oldest of entries.keys()) {
        if (entries.size <= MAX_ENTRIES) break;
        entries.delete(oldest);
      }
    },

    lookup(id) {
      return entries.get(id);
    },

    size() {
      return entries.size;
    },
  };
}
