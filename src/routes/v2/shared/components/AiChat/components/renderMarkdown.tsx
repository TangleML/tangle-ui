import { type ComponentProps, type ReactNode } from "react";
import { type Components, defaultUrlTransform } from "react-markdown";

import {
  INLINE_CODE_CLASS,
  Markdown,
} from "@/components/shared/Markdown/Markdown";
import { Link } from "@/components/ui/link";
import type { ComponentRefData } from "@/routes/v2/shared/components/AiChat/types";
import { CodeBlock } from "@/routes/v2/shared/components/CodeBlock";

import {
  ComponentChipFromContext,
  ComponentRefsContext,
} from "./ComponentChipFromContext";
import { EntityChip } from "./EntityChip";

const ENTITY_PROTOCOL = "entity://";
const COMPONENT_PROTOCOL = "component://";

function urlTransform(url: string): string {
  if (url.startsWith(ENTITY_PROTOCOL)) return url;
  if (url.startsWith(COMPONENT_PROTOCOL)) return url;
  return defaultUrlTransform(url);
}

function extractLabel(children: ReactNode, fallback: string): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.join("");
  return String(children ?? fallback);
}

function MarkdownLink({
  href,
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  if (href?.startsWith(ENTITY_PROTOCOL)) {
    const entityId = href.slice(ENTITY_PROTOCOL.length);
    return (
      <EntityChip
        entityId={entityId}
        label={extractLabel(children, entityId)}
      />
    );
  }

  if (href?.startsWith(COMPONENT_PROTOCOL)) {
    const componentId = href.slice(COMPONENT_PROTOCOL.length);
    const label = extractLabel(children, componentId);
    return <ComponentChipFromContext componentId={componentId} label={label} />;
  }

  return (
    <Link href={href} size="sm" variant="primary" external>
      {children}
    </Link>
  );
}

function MarkdownCode({
  className,
  children,
  node: _node,
  ...rest
}: ComponentProps<"code"> & { node?: unknown }) {
  const match = className?.match(/language-(\w+)/);

  if (match) {
    const code = String(children).replace(/\n$/, "");
    return (
      <CodeBlock
        code={code}
        language={match[1]}
        showLineNumbers={false}
        className="my-1 h-auto max-h-64 rounded-md text-xs"
      />
    );
  }

  return (
    <code className={INLINE_CODE_CLASS} {...rest}>
      {children}
    </code>
  );
}

const chatComponents = {
  a: MarkdownLink,
  code: MarkdownCode,
  // `MarkdownCode` already renders a fenced block as a `CodeBlock`, which brings
  // its own surround.
  pre: ({ children }: { children?: ReactNode }) => <>{children}</>,
} satisfies Components;

export function renderMarkdown(
  text: string,
  componentReferences?: Record<string, ComponentRefData>,
): ReactNode {
  const markdown = (
    <Markdown
      body={text}
      components={chatComponents}
      urlTransform={urlTransform}
    />
  );

  if (!componentReferences) return markdown;

  return (
    <ComponentRefsContext.Provider value={componentReferences}>
      {markdown}
    </ComponentRefsContext.Provider>
  );
}
