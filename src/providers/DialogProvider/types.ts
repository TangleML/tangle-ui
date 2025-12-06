import { type ComponentType } from "react";

export type DialogProps<T = any, TProps = {}> = {
  close: (result?: T) => void;
  cancel: () => void;
} & TProps;

export interface DialogConfig<T = any, TProps = {}> {
  component: ComponentType<DialogProps<T, TProps>>;
  props?: TProps;
  routeKey?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnEsc?: boolean;
  closeOnOverlayClick?: boolean;
}

export interface DialogInstance<T = any, TProps = {}>
  extends DialogConfig<T, TProps> {
  id: string;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

export interface DialogContextValue {
  open: <T = any, TProps = {}>(config: DialogConfig<T, TProps>) => Promise<T>;
  close: (id: string, result?: any) => void;
  cancel: (id: string) => void;
  closeAll: () => void;
  stack: DialogInstance[];
}

export interface PromiseCallbacks<T = any> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

export class DialogCancelledError extends Error {
  name = "DialogCancelledError";
}
