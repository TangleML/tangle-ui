import { InfoBox } from "@/components/shared/InfoBox";
import { UntrustedMarkdown } from "@/components/shared/Markdown/Markdown";

import { getSystemErrorSummary } from "./systemErrorSummary";

interface SystemErrorSectionProps {
  systemErrorExceptionFull?: string | null;
  className?: string;
}

export const SystemErrorSection = ({
  systemErrorExceptionFull,
  className,
}: SystemErrorSectionProps) => {
  const summary = getSystemErrorSummary(systemErrorExceptionFull);

  if (!summary) return null;

  return (
    <InfoBox
      title="System error"
      variant="error"
      width="full"
      className={className}
    >
      {/* Markdown for the autolinking: a message that names a URL to visit is
          only actionable if it can be clicked. */}
      <UntrustedMarkdown body={summary} />
    </InfoBox>
  );
};
