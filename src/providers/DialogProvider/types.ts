import { type ComponentType } from "react";

export type DialogProps<T = unknown, TProps = {}> = {
  close: (result?: T) => void;
  cancel: () => void;
} & TProps;

export interface DialogConfig<T = unknown, TProps = {}> {
  component: ComponentType<DialogProps<T, TProps>>;
  props?: TProps;
  routeKey?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnEsc?: boolean;
  closeOnOverlayClick?: boolean;
}

// DialogInstance uses `any` for resolve/reject because the dialog stack is
// heterogeneous — different dialogs have different T. Using `unknown` here
// would break variance when constructing instances from Promise callbacks.
export interface DialogInstance<T = unknown, TProps = {}> extends DialogConfig<
  T,
  TProps
> {
  id: string;

  resolve: (value: any) => void;

  reject: (reason?: any) => void;
}

export interface DialogContextValue {
  open: <T = unknown, TProps = {}>(
    config: DialogConfig<T, TProps>,
  ) => Promise<T>;
  close: (id: string, result?: unknown) => void;
  cancel: (id: string) => void;
  closeAll: () => void;
  stack: DialogInstance[];
}

// Same variance reasoning as DialogInstance above.
export interface PromiseCallbacks {
  resolve: (value: any) => void;

  reject: (reason?: any) => void;
}

export class DialogCancelledError extends Error {
  name = "DialogCancelledError";
}
