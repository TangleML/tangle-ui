import type { IdGenerator } from "../factories/idGenerator";
import { IncrementingIdGenerator } from "../factories/idGenerator";
import {
  IndexManager,
  indexManager as globalIndexManager,
} from "../indexes/indexManager";
import type { BaseEntity } from "./baseEntity";

export interface EntityContextInit {
  parent?: BaseEntity;
  indexManager?: IndexManager;
  idGenerator?: IdGenerator;
}

export class EntityContext {
  readonly parent: BaseEntity | null;
  readonly indexManager: IndexManager;
  readonly idGenerator: IdGenerator;

  constructor(init: EntityContextInit = {}) {
    this.parent = init.parent ?? null;
    this.indexManager = init.indexManager ?? globalIndexManager;
    this.idGenerator = init.idGenerator ?? new IncrementingIdGenerator();
  }

  /** Create a child context inheriting indexManager and idGenerator */
  child(parent: BaseEntity): EntityContext {
    return new EntityContext({
      parent,
      indexManager: this.indexManager,
      idGenerator: this.idGenerator,
    });
  }

  nextId(prefix?: string): string {
    return this.idGenerator.next(prefix);
  }
}
