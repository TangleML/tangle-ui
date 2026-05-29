import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/typography";
import { DOCUMENTATION_URL } from "@/utils/constants";
import { tracking } from "@/utils/tracking";

interface QuickLink {
  id: string;
  label: string;
  href: string;
  icon: IconName;
}

const QUICK_LINKS: QuickLink[] = [
  {
    id: "getting-started",
    label: "Getting started",
    href: `${DOCUMENTATION_URL}getting-started/first-pipeline/`,
    icon: "Rocket",
  },
  {
    id: "components",
    label: "Components",
    href: `${DOCUMENTATION_URL}core-concepts/what-are-components/`,
    icon: "Package",
  },
  {
    id: "pipelines",
    label: "Pipelines",
    href: `${DOCUMENTATION_URL}core-concepts/understanding-inputs-outputs/`,
    icon: "GitBranch",
  },
  {
    id: "secrets",
    label: "Secrets & auth",
    href: `${DOCUMENTATION_URL}core-concepts/secrets/`,
    icon: "Lock",
  },
  {
    id: "runs",
    label: "Running pipelines",
    href: `${DOCUMENTATION_URL}core-concepts/tasks-and-executions/`,
    icon: "Play",
  },
  {
    id: "schema",
    label: "Schema reference",
    href: `${DOCUMENTATION_URL}reference/schema/`,
    icon: "Code",
  },
];

function QuickLinkPill({ link }: { link: QuickLink }) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border hover:border-primary/40 hover:bg-muted/40 transition-all no-underline"
      {...tracking("learning_hub.documentation.quick_link", {
        link_id: link.id,
      })}
    >
      <Icon
        name={link.icon}
        size="xs"
        className="text-muted-foreground shrink-0"
        aria-hidden="true"
      />
      <Text size="sm" weight="semibold">
        {link.label}
      </Text>
    </a>
  );
}

export function DocsQuickLinks() {
  return (
    <BlockStack gap="1">
      <Text size="sm" weight="semibold" className="text-muted-foreground">
        Quick links
      </Text>
      <InlineStack gap="2">
        {QUICK_LINKS.map((link) => (
          <QuickLinkPill key={link.id} link={link} />
        ))}
        <Link
          href={DOCUMENTATION_URL}
          external
          variant="primary"
          size="sm"
          className="ml-1"
          {...tracking("learning_hub.documentation.full_docs")}
        >
          Full docs
        </Link>
      </InlineStack>
    </BlockStack>
  );
}
