import { isObservable, toJS } from "mobx";

export const deepClone = <T>(obj: T): T =>
  JSON.parse(JSON.stringify(isObservable(obj) ? toJS(obj) : obj));
