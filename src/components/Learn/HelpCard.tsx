import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Heading, Paragraph } from "@/components/ui/typography";
import { GITHUB_DISCUSSIONS_URL, GIVE_FEEDBACK_URL } from "@/utils/constants";
import { tracking } from "@/utils/tracking";

export function HelpCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <BlockStack gap="3">
        <InlineStack gap="2" blockAlign="center">
          <Icon
            name="MessageCircle"
            size="md"
            className="text-primary"
            aria-hidden="true"
          />
          <Heading level={3}>Need more help?</Heading>
        </InlineStack>
        <Paragraph size="sm" tone="subdued">
          {"Tangle is open source. Reach out, share an idea, or report a bug."}
        </Paragraph>
        <BlockStack gap="2" align="start">
          <Link
            href={GITHUB_DISCUSSIONS_URL}
            external
            variant="primary"
            size="sm"
            {...tracking("learning_hub.help.discussions")}
          >
            Ask the community
          </Link>
          <Link
            href={GIVE_FEEDBACK_URL}
            external
            variant="primary"
            size="sm"
            {...tracking("learning_hub.help.report_bug")}
          >
            Report a bug
          </Link>
        </BlockStack>
      </BlockStack>
    </div>
  );
}
