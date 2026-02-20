import type { z } from "zod";

interface TypedStorage<
  TKeys extends string,
  TMapping extends Record<TKeys, unknown>,
> {
  setItem<TKey extends TKeys>(key: TKey, value: TMapping[TKey]): void;
  getItem<TKey extends TKeys>(key: TKey): TMapping[TKey] | null;
}

type EncoderDecoder<
  TKeys extends string,
  TMapping extends Record<TKeys, unknown>,
> = {
  encode: (value: TMapping[TKeys]) => string;
  decode: <TKey extends TKeys>(value: string) => TMapping[TKey];
};

interface StorageOptions<
  TKeys extends string,
  TMapping extends Record<TKeys, unknown>,
> extends EncoderDecoder<TKeys, TMapping> {
  /** Zod schemas keyed by storage key for runtime validation on read */
  schemas?: Partial<{ [K in TKeys]: z.ZodType<TMapping[K]> }>;
}

export function getStorage<
  TKeys extends string,
  TMapping extends Record<TKeys, unknown>,
>(
  options?: Partial<StorageOptions<TKeys, TMapping>>,
): TypedStorage<TKeys, TMapping> {
  const encode = options?.encode ?? JSON.stringify;
  const decode = options?.decode ?? JSON.parse;
  const schemas = options?.schemas;

  return {
    setItem(key, value) {
      try {
        if (value === null) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, encode(value));
        }

        /**
         * On localStoage.setItem, the storage event is only triggered on other tabs and windows.
         * So we manually dispatch a storage event to trigger the subscribe function on the current window as well.
         */
        window.dispatchEvent(
          new StorageEvent("storage", {
            key,
            newValue: encode(value),
          }),
        );
      } catch {
        // Ignore if storage restriction error
      }
    },
    getItem<TKey extends TKeys>(key: TKey): TMapping[TKey] | null {
      try {
        const storedValue = localStorage.getItem(key);
        if (storedValue) {
          const decoded = decode(storedValue);
          const schema = schemas?.[key];
          return schema ? schema.parse(decoded) : decoded;
        }
      } catch {
        // Ignore if storage restriction or parsing error
      }
      return null;
    },
  };
}
