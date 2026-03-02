interface Indexable {
  readonly $namespace: string;
  [key: string]: unknown;
}

export class IndexManager {
  private data = new Map<string, Set<unknown>>();

  private key(namespace: string, field: string, value: unknown): string {
    return `${namespace}:${field}:${String(value)}`;
  }

  index<T extends Indexable>(entity: T, field: string): void {
    const k = this.key(entity.$namespace, field, entity[field]);
    if (!this.data.has(k)) this.data.set(k, new Set());
    this.data.get(k)!.add(entity);
  }

  reindex<T extends Indexable>(
    entity: T,
    field: string,
    oldValue: unknown,
  ): void {
    this.data.get(this.key(entity.$namespace, field, oldValue))?.delete(entity);
    const k = this.key(entity.$namespace, field, entity[field]);
    if (!this.data.has(k)) this.data.set(k, new Set());
    this.data.get(k)!.add(entity);
  }

  unindex<T extends Indexable>(entity: T, field: string): void {
    this.data
      .get(this.key(entity.$namespace, field, entity[field]))
      ?.delete(entity);
  }

  find<T>(namespace: string, field: string, value: unknown): T[] {
    return [...(this.data.get(this.key(namespace, field, value)) ?? [])] as T[];
  }

  findOne<T>(namespace: string, field: string, value: unknown): T | undefined {
    return this.find<T>(namespace, field, value)[0];
  }

  clear(): void {
    this.data.clear();
  }
}

export let indexManager = new IndexManager();

export const setIndexManager = (im: IndexManager): void => {
  indexManager = im;
};

export const resetIndexManager = (): void => {
  indexManager = new IndexManager();
};
