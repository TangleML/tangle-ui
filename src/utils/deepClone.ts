import { isObservable, toJS } from "mobx";

export const deepClone = <T>(obj: T): T =>
  structuredClone(isObservable(obj) ? toJS(obj) : obj);
