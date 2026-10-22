import { Fragment } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { TeamResolution, TeamSummary } from "@/services/teams/types";

import { TeamName } from "./TeamName";

const RUNS_FALL_BACK_TO_YOU =
  "Runs you submit for this project run as you instead, with your own secrets.";

export function ActingTeamNotice({
  resolution,
}: {
  resolution: TeamResolution;
}) {
  switch (resolution.status) {
    case "not-member":
      return (
        <InfoBox
          title={
            <>
              {"You're not in the "}
              <TeamName team={resolution.team} />
              {" workspace"}
            </>
          }
          variant="warning"
          width="full"
        >
          {`Runs can act as the workspace to use its secrets. ${RUNS_FALL_BACK_TO_YOU} Ask an admin to add you to the workspace.`}
        </InfoBox>
      );
    case "unavailable":
      return (
        <InfoBox
          title={
            <>
              {"Can't act as the "}
              <TeamName team={resolution.team} />
              {" workspace"}
            </>
          }
          variant="warning"
          width="full"
        >
          {`The backend didn't let you act as this project's workspace. ${RUNS_FALL_BACK_TO_YOU}`}
        </InfoBox>
      );
    case "error":
      return (
        <InfoBox
          title="Couldn't check this project's workspace"
          variant="warning"
          width="full"
        >
          <BlockStack gap="1">
            <Text size="sm">{resolution.error.message}</Text>
            <Text size="sm">
              {
                "Until it's checked, runs you submit for this project run as you, with your own secrets."
              }
            </Text>
          </BlockStack>
        </InfoBox>
      );
    case "conflict":
      return (
        <InfoBox
          title="These projects belong to different workspaces"
          variant="error"
          width="full"
        >
          {"A run can only act as one workspace, and these projects use "}
          <TeamNames teams={resolution.teams} />
          {". File the run under projects on one workspace."}
        </InfoBox>
      );
    default:
      return null;
  }
}

function TeamNames({ teams }: { teams: TeamSummary[] }) {
  return teams.map((team, index) => (
    <Fragment key={team.id}>
      {index > 0 && " and "}
      <TeamName team={team} />
    </Fragment>
  ));
}
