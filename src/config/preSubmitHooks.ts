import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";

export interface PreSubmitContext {
  componentSpec: ComponentSpec;
  taskArguments?: Record<string, ArgumentType>;
}

export interface PreSubmitResult {
  proceed: boolean;
}

export type PreSubmitHook = (ctx: PreSubmitContext) => Promise<PreSubmitResult>;

export interface ConfirmPayload {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  dismissForeverKey?: string;
}

export interface ConfirmResult {
  confirmed: boolean;
  dismissForever: boolean;
}

declare global {
  interface Window {
    __TANGLE_PRE_SUBMIT_HOOKS__?: PreSubmitHook[];
    __TANGLE_CONFIRM__?: (payload: ConfirmPayload) => Promise<ConfirmResult>;
  }
}
