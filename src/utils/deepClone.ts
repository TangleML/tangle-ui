import { isObservable, toJS } from "mobx";

export function deepClone<T>(obj: T): T {
  try {
    return structuredClone(isObservable(obj) ? toJS(obj) : obj);
  } catch {
    /**
     * serializeComponentSpec returns an object that's not itself observable
     * (so isObservable returns false), but contains nested non-cloneable values.
     *
     * todo: implement a proper serialization which strips off observable wrappers.
     */
    return JSON.parse(JSON.stringify(obj));
  }
}
