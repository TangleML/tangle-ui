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
