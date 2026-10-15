import { Fragment } from "react";

import { Icon } from "@/components/ui/icon";

const URL_WITHOUT_TRAILING_PUNCTUATION = /https?:\/\/\S*[^\s.,;:!?)\]}'"]/g;

interface DescriptionWithLinksProps {
  text: string;
}

export function DescriptionWithLinks({ text }: DescriptionWithLinksProps) {
  const parts = text.split(URL_WITHOUT_TRAILING_PUNCTUATION);
  const urls = text.match(URL_WITHOUT_TRAILING_PUNCTUATION) ?? [];

  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {urls[i] && (
            <a
              href={urls[i]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 break-all underline hover:opacity-80"
            >
              {urls[i]}
              <Icon name="ExternalLink" className="size-3 shrink-0" />
            </a>
          )}
        </Fragment>
      ))}
    </>
  );
}
