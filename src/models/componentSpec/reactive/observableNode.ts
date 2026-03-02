export type ChangeType =
  | "changed.self.entity"
  | "changed.self.collection"
  | "changed.child";

export interface ChangeDetail {
  type: ChangeType;
  source: ObservableNode;
  field: string;
  value: unknown;
  oldValue: unknown;
}

export type ChangeEvent = CustomEvent<ChangeDetail>;

export interface SubscribeOptions {
  signal?: AbortSignal;
}

type ChangeListener = (detail: ChangeDetail) => void;

function matchPattern(pattern: string, eventType: ChangeType): boolean {
  if (pattern === "*") return true;
  if (pattern === eventType) return true;

  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -1);
    return eventType.startsWith(prefix);
  }

  return false;
}

export function isObservableNode(item: unknown): item is ObservableNode {
  return (
    item !== null &&
    typeof item === "object" &&
    "attachToParent" in item &&
    typeof (item as ObservableNode).attachToParent === "function"
  );
}

export abstract class ObservableNode extends EventTarget {
  parent: ObservableNode | null = null;

  protected emitChange(
    type: ChangeType,
    field: string,
    value: unknown,
    oldValue: unknown,
  ): void {
    const detail: ChangeDetail = {
      type,
      source: this,
      field,
      value,
      oldValue,
    };

    this.dispatchEvent(new CustomEvent("change", { detail }));

    if (this.parent) {
      this.parent.bubbleChildChange(detail);
    }
  }

  private bubbleChildChange(originalDetail: ChangeDetail): void {
    const detail: ChangeDetail = {
      ...originalDetail,
      type: "changed.child",
    };

    this.dispatchEvent(new CustomEvent("change", { detail }));

    if (this.parent) {
      this.parent.bubbleChildChange(originalDetail);
    }
  }

  subscribe(
    pattern: string,
    listener: ChangeListener,
    options?: SubscribeOptions,
  ): () => void {
    const handler = (e: Event) => {
      const detail = (e as ChangeEvent).detail;
      if (matchPattern(pattern, detail.type)) {
        listener(detail);
      }
    };

    this.addEventListener("change", handler, { signal: options?.signal });

    return () => this.removeEventListener("change", handler);
  }

  attachToParent(newParent: ObservableNode): void {
    this.parent = newParent;
    console.log(`attachToParent ${this.$id} -> ${newParent.$id}`);
    this.onAttached(newParent);
  }

  detachFromParent(): void {
    this.onDetached();
    this.parent = null;
  }

  protected onAttached(_parent: ObservableNode): void {
    // Override in subclasses for attachment logic
  }

  protected onDetached(): void {
    // Override in subclasses for detachment logic
  }
}
