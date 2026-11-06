import { Fragment, type ReactNode, useId } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import type {
  RunAs,
  RunAsRule,
  RunIdentity,
} from "@/components/shared/SecretsManagement/runIdentity";
import { ActingTeamNotice } from "@/components/shared/Teams/ActingTeamNotice";
import { TeamName } from "@/components/shared/Teams/TeamName";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radiogroup";
import { Text } from "@/components/ui/typography";
import { fallsBackToYou } from "@/services/teams/teamResolution";
import type { TeamResolution, TeamSummary } from "@/services/teams/types";

interface RunIdentitySummaryProps {
  team: TeamResolution;
  identity: RunIdentity;
  runAs: RunAs;
  onRunAsChange: (runAs: RunAs) => void;
}

function SecretNames({ names }: { names: readonly string[] }) {
  return names.map((name, index) => (
    <Fragment key={name}>
      {index > 0 && ", "}
      <span className="whitespace-nowrap font-semibold">
        <Icon
          name="Lock"
          size="xs"
          className="mr-0.5 inline-block align-text-bottom"
        />
        {name}
      </span>
    </Fragment>
  ));
}

function isOrAre(
  names: readonly string[],
  singular: string,
  plural: string,
): ReactNode {
  return (
    <>
      <SecretNames names={names} />
      {` ${names.length === 1 ? singular : plural}`}
    </>
  );
}

const isnt = (names: readonly string[]) => isOrAre(names, "isn't", "aren't");
const itOrThem = (names: readonly string[]) =>
  names.length === 1 ? "it" : "them";

function RunAsControl({
  team,
  rule,
  runAs,
  onChange,
}: {
  team: TeamSummary;
  rule: RunAsRule;
  runAs: RunAs;
  onChange: (runAs: RunAs) => void;
}) {
  const id = useId();
  const teamOnly = rule.kind === "team-required" ? rule.teamOnly : [];

  return (
    <BlockStack gap="1">
      <Text size="sm" tone="subdued" id={`${id}-label`}>
        Run as
      </Text>
      <RadioGroup
        value={runAs}
        onValueChange={(value) => onChange(value === "team" ? "team" : "you")}
        aria-labelledby={`${id}-label`}
        className="flex flex-wrap gap-4"
      >
        <InlineStack gap="2" blockAlign="center" wrap="nowrap">
          <RadioGroupItem
            id={`${id}-you`}
            value="you"
            disabled={teamOnly.length > 0}
          />
          <Label htmlFor={`${id}-you`} className="font-normal">
            You
          </Label>
        </InlineStack>
        <InlineStack gap="2" blockAlign="center" wrap="nowrap">
          <RadioGroupItem id={`${id}-team`} value="team" />
          <Label htmlFor={`${id}-team`} className="gap-1 font-normal">
            {"Workspace: "}
            <TeamName team={team} />
          </Label>
        </InlineStack>
      </RadioGroup>
      {teamOnly.length > 0 && (
        <Text size="xs" tone="subdued" data-testid="run-as-team-reason">
          {"Only the "}
          <TeamName team={team} />
          {" workspace has "}
          <SecretNames names={teamOnly} />
          {", so the run goes as the workspace."}
        </Text>
      )}
    </BlockStack>
  );
}

function SplitSecretsMessage({
  team,
  rule,
  missing,
}: {
  team: TeamSummary;
  rule: Extract<RunAsRule, { kind: "split" }>;
  missing: RunIdentity["missing"];
}) {
  const inNeither = missing.you.filter((name) => missing.team.includes(name));
  return (
    <>
      {isOrAre(rule.yoursOnly, "is", "are")}
      {" only in your secrets, and "}
      {isOrAre(rule.teamOnly, "is", "are")}
      {" only in the "}
      <TeamName team={team} />
      {" workspace's, so the run will fail whichever it runs as."}
      {inNeither.length > 0 && (
        <>
          {" "}
          {isnt(inNeither)}
          {" in either."}
        </>
      )}
      {" Add the missing secrets to one of them."}
    </>
  );
}

function MissingSecretsMessage({
  team,
  identity,
  runAs,
}: {
  team: TeamResolution;
  identity: RunIdentity;
  runAs: RunAs;
}) {
  const missing = identity.missing[runAs];
  const otherSide = identity.missing[runAs === "you" ? "team" : "you"];
  const otherSideHas = identity.team
    ? missing.filter((name) => !otherSide.includes(name))
    : [];
  const inNeither = missing.filter((name) => !otherSideHas.includes(name));

  const where = (names: readonly string[]) =>
    runAs === "team" && identity.team ? (
      <>
        {isnt(names)}
        {" in the "}
        <TeamName team={identity.team} />
        {" workspace's secrets"}
      </>
    ) : (
      <>
        {isnt(names)}
        {" in your secrets"}
      </>
    );

  return (
    <>
      {otherSideHas.length > 0 && identity.team && (
        <>
          {where(otherSideHas)}
          {runAs === "you" ? (
            <>
              {"; the "}
              <TeamName team={identity.team} />
              {` workspace has ${itOrThem(otherSideHas)}.`}
            </>
          ) : (
            `; you have ${itOrThem(otherSideHas)}.`
          )}
        </>
      )}
      {otherSideHas.length > 0 && inNeither.length > 0 && " "}
      {inNeither.length > 0 && (
        <>
          {where(inNeither)}
          {", so the run will fail when it starts."}
          {team.status === "none" &&
            " If it's a workspace's secret, submit the run from one of that workspace's projects."}
        </>
      )}
    </>
  );
}

export function RunIdentitySummary({
  team,
  identity,
  runAs,
  onRunAsChange,
}: RunIdentitySummaryProps) {
  const { rule } = identity;
  const missing = identity.missing[runAs];

  return (
    <BlockStack gap="2">
      {identity.team ? (
        <RunAsControl
          team={identity.team}
          rule={rule}
          runAs={runAs}
          onChange={onRunAsChange}
        />
      ) : (
        fallsBackToYou(team) && (
          <InlineStack gap="1" blockAlign="center" wrap="nowrap">
            <Icon
              name="User"
              size="xs"
              className="shrink-0 text-muted-foreground"
            />
            <Text size="sm" tone="subdued">
              Runs as you
            </Text>
          </InlineStack>
        )
      )}
      <ActingTeamNotice resolution={team} />
      {rule.kind === "split" && identity.team ? (
        <InfoBox
          title="Secrets split between you and the workspace"
          variant="warning"
          width="full"
        >
          <SplitSecretsMessage
            team={identity.team}
            rule={rule}
            missing={identity.missing}
          />
        </InfoBox>
      ) : (
        missing.length > 0 && (
          <InfoBox title="Missing secrets" variant="warning" width="full">
            <MissingSecretsMessage
              team={team}
              identity={identity}
              runAs={runAs}
            />
          </InfoBox>
        )
      )}
    </BlockStack>
  );
}
