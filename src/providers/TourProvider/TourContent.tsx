import { Fragment, type ReactNode } from "react";

import { Paragraph } from "@/components/ui/typography";

const INLINE_TOKEN = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g;

export function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_TOKEN).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function TourContent({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <Paragraph key={index} className={index > 0 ? "mt-2" : undefined}>
          {renderInline(paragraph)}
        </Paragraph>
      ))}
    </>
  );
}
