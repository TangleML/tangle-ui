import { toJS } from "mobx";

export const deepClone = <T>(obj: T): T => structuredClone(toJS(obj));
