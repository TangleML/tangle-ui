import { type ComponentProps, type ReactNode } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Link } from "@/components/ui/link";
import { Separator } from "@/components/ui/separator";
import { Paragraph, Text } from "@/components/ui/typography";
import type { ComponentRefData } from "@/routes/v2/shared/components/AiChat/types";
import { CodeBlock } from "@/routes/v2/shared/components/CodeBlock";

import {
  ComponentChipFromContext,
  ComponentRefsContext,
  INLINE_CODE_CLASS,
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
    <Link href={href} variant="primary" external>
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

const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <Text as="h1" size="md" weight="bold" className="mt-3 mb-1 block">
      {children}
    </Text>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <Text as="h2" size="sm" weight="bold" className="mt-2 mb-1 block">
      {children}
    </Text>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <Text as="h3" size="sm" weight="semibold" className="mt-2 mb-0.5 block">
      {children}
    </Text>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <Text as="h4" size="sm" weight="semibold" className="mt-1 block">
      {children}
    </Text>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <Paragraph size="sm" className="my-1 leading-relaxed">
      {children}
    </Paragraph>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="list-disc pl-4 my-1">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="list-decimal pl-4 my-1">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="my-0.5">{children}</li>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-1 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-2 overflow-x-auto rounded-md border">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead className="bg-muted/50">{children}</thead>
  ),
  tbody: ({ children }: { children?: ReactNode }) => <tbody>{children}</tbody>,
  tr: ({ children }: { children?: ReactNode }) => (
    <tr className="border-b last:border-b-0">{children}</tr>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="px-2 py-1">{children}</td>
  ),
  hr: () => <Separator className="my-2" />,
  a: MarkdownLink,
  code: MarkdownCode,
  pre: ({ children }: { children?: ReactNode }) => <>{children}</>,
} as const;

export function renderMarkdown(
  text: string,
  componentReferences?: Record<string, ComponentRefData>,
): ReactNode {
  const markdown = (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
      urlTransform={urlTransform}
    >
      {text}
    </Markdown>
  );

  if (!componentReferences) return markdown;

  return (
    <ComponentRefsContext.Provider value={componentReferences}>
      {markdown}
    </ComponentRefsContext.Provider>
  );
}
