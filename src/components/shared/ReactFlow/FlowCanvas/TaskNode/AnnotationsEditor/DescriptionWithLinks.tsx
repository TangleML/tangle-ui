import { Fragment } from "react";

import { Icon } from "@/components/ui/icon";

// A URL that ends a sentence must not swallow the punctuation into its href, so the
// match may not end on a character that reads as prose rather than as the address.
const URL_REGEX = /https?:\/\/\S*[^\s.,;:!?)\]}'"]/g;

interface DescriptionWithLinksProps {
  text: string;
}

export function DescriptionWithLinks({ text }: DescriptionWithLinksProps) {
  const parts = text.split(URL_REGEX);
  const urls = text.match(URL_REGEX) ?? [];

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
