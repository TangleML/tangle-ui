import type { DetailedHTMLProps, HTMLAttributes } from "react";

/**
 * Ambient JSX declaration for the `<tangent-provider>` custom element rendered
 * directly by `TangentEmbedProvider`. The embed-react package ships the same
 * augmentation, but the local `link:` to its source resolves a different
 * `@types/react` copy, so that augmentation does not reach tangle-ui's JSX.
 * Other `tangent-*` elements are rendered inside embed-react's own components
 * and stay covered by its declaration.
 */
type TangentElementProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement> & { instance?: string },
  HTMLElement
>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "tangent-provider": TangentElementProps;
    }
  }
}
