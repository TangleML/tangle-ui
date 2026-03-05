export interface IdGenerator {
  next(prefix?: string): string;
}

let globalCounter = 0;

function generateUniqueId(prefix: string): string {
  globalCounter++;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${timestamp}${random}_${globalCounter}`;
}

export class IncrementingIdGenerator implements IdGenerator {
  next(prefix = "entity"): string {
    return generateUniqueId(prefix);
  }

  reset(): void {
    // No-op for UUID-based generator
  }
}

/**
 * Replays a pre-recorded sequence of IDs during deserialization,
 * ensuring the same entities get the same $id values across save/load cycles.
 * Falls back to random ID generation if the stack is exhausted.
 */
export class ReplayIdGenerator implements IdGenerator {
  private index = 0;
  private readonly fallback = new IncrementingIdGenerator();

  constructor(private readonly idStack: string[]) {}

  next(prefix = "entity"): string {
    if (this.index < this.idStack.length) {
      return this.idStack[this.index++];
    }
    return this.fallback.next(prefix);
  }

  get consumed(): number {
    return this.index;
  }

  get isExhausted(): boolean {
    return this.index >= this.idStack.length;
  }
}
