export type BaseEntity<
  TScalar = {},
  TKey extends keyof TScalar = keyof TScalar,
> = {
  readonly $id: string;
  readonly $indexed: TKey[];

  populate(scalar: TScalar): BaseEntity<TScalar, TKey>;
} & {
  [K in TKey]: TScalar[K];
};

export type ScalarType = undefined | null | string | number | boolean;

export interface SerializableEntity {
  toJson(): object | ScalarType;
}

export function isSerializableEntity(
  entity: unknown,
): entity is SerializableEntity {
  return (
    !!entity &&
    typeof entity === "object" &&
    "toJson" in entity &&
    typeof entity.toJson === "function"
  );
}

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type RequiredProperties<T> = Pick<T, RequiredKeys<T>>;
