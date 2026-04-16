import { createContext, type ReactNode, useContext } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ComponentRefData } from "@/routes/v2/pages/Editor/components/AiChat/aiChat.types";
import { CodeBlock } from "@/routes/v2/pages/Editor/components/PinnedTaskContent/components/CodeBlock";

import { ComponentChip } from "./ComponentChip";
import { EntityChip } from "./EntityChip";

const ENTITY_PROTOCOL = "entity://";
const COMPONENT_PROTOCOL = "component://";

const ComponentRefsContext = createContext<
  Record<string, ComponentRefData> | undefined
>(undefined);

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
    return <EntityChip entityId={entityId} label={extractLabel(children, entityId)} />;
  }

  if (href?.startsWith(COMPONENT_PROTOCOL)) {
    const componentId = href.slice(COMPONENT_PROTOCOL.length);
    const label = extractLabel(children, componentId);
    return <ComponentChipFromContext componentId={componentId} label={label} />;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  );
}

function ComponentChipFromContext({
  componentId,
  label,
}: {
  componentId: string;
  label: string;
}) {
  const refs = useContext(ComponentRefsContext);
  const refData = refs?.[componentId];

  if (!refData) {
    return (
      <span className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
        {label}
      </span>
    );
  }

  return <ComponentChip componentRef={refData} label={label} />;
}

function MarkdownCode({
  className,
  children,
  ...rest
}: React.ComponentProps<"code"> & { node?: unknown }) {
  const match = className?.match(/language-(\w+)/);

  if (match) {
    const code = String(children).replace(/\n$/, "");
    return (
      <CodeBlock
        code={code}
        language={match[1]}
        showLineNumbers={false}
        className="my-1 rounded-md text-xs"
      />
    );
  }

  return (
    <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono" {...rest}>
      {children}
    </code>
  );
}

const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="text-sm font-bold mt-2 mb-1">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="text-sm font-semibold mt-2 mb-0.5">{children}</h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4 className="text-sm font-semibold mt-1">{children}</h4>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-1 leading-relaxed">{children}</p>
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
  hr: () => <hr className="my-2 border-muted-foreground/20" />,
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
