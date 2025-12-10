import { Heading, Text } from "@/components/ui/typography";

export function RecentRunsTitle({
  pipelineName,
  runsCount,
}: {
  pipelineName?: string;
  runsCount?: number;
}) {
  return (
    <Heading level={3}>
      {pipelineName ? <Text weight="bold">{pipelineName}</Text> : null}
      {pipelineName ? " - " : ""}
      {runsCount ? `${runsCount} runs` : "Recent Pipeline Runs"}
    </Heading>
  );
}
