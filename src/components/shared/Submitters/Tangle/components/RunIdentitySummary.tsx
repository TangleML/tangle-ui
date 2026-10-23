import { InfoBox } from "@/components/shared/InfoBox";
import { ActingTeamNotice } from "@/components/shared/Teams/ActingTeamNotice";
import { TeamName } from "@/components/shared/Teams/TeamName";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { fallsBackToYou } from "@/services/teams/teamResolution";
import type { TeamResolution } from "@/services/teams/types";

interface RunIdentitySummaryProps {
  team: TeamResolution;
  missingSecrets: readonly string[];
}

function runsAs(team: TeamResolution) {
  if (team.status === "active") {
    return {
      icon: "Users",
      label: `Runs as Team: ${team.team.label}`,
      title: team.team.id,
    } as const;
  }
  if (fallsBackToYou(team)) {
    return { icon: "User", label: "Runs as you", title: undefined } as const;
  }
  return null;
}

function MissingSecretsMessage({
  names,
  team,
}: {
  names: readonly string[];
  team: TeamResolution;
}) {
  const subject =
    names.length === 1 ? `${names[0]} isn't` : `${names.join(", ")} aren't`;
  if (team.status === "active") {
    return (
      <>
        {`${subject} one of the `}
        <TeamName team={team.team} />
        {" team's secrets, so the run will fail when it starts."}
      </>
    );
  }
  const missingFromYours = `${subject} in your secrets, so the run will fail when it starts.`;
  return team.status === "none"
    ? `${missingFromYours} If it's a team's secret, submit the run from one of that team's projects.`
    : missingFromYours;
}

export function RunIdentitySummary({
  team,
  missingSecrets,
}: RunIdentitySummaryProps) {
  const identity = runsAs(team);

  return (
    <BlockStack gap="2">
      {identity && (
        <InlineStack gap="1" blockAlign="center" wrap="nowrap">
          <Icon
            name={identity.icon}
            size="xs"
            className="shrink-0 text-muted-foreground"
          />
          <Text
            size="sm"
            tone="subdued"
            className="min-w-0 truncate"
            title={identity.title}
          >
            {identity.label}
          </Text>
        </InlineStack>
      )}
      <ActingTeamNotice resolution={team} />
      {missingSecrets.length > 0 && (
        <InfoBox title="Missing secrets" variant="warning" width="full">
          <MissingSecretsMessage names={missingSecrets} team={team} />
        </InfoBox>
      )}
    </BlockStack>
  );
}
