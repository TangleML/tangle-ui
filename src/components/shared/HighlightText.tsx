interface HighlightTextProps {
  text: string;
  query: string | undefined;
  className?: string;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function HighlightText({ text, query, className }: HighlightTextProps) {
  if (!query) return <span className={className}>{text}</span>;

  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <strong key={i}>{part}</strong>
        ) : (
          part
        ),
      )}
    </span>
  );
}
