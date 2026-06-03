import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
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

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "create-pipeline",
    question: "How do I create my first pipeline?",
    answer:
      "Open the Pipelines tab and click 'New pipeline', or import one of the example pipelines from the Learning Hub to get started quickly.",
  },
  {
    id: "share-pipeline",
    question: "Can I share a pipeline with someone else?",
    answer:
      "Yes — export the pipeline as YAML from the editor and share the file. The recipient can import it from the home dashboard.",
  },
  {
    id: "secrets",
    question: "Where are secrets stored?",
    answer:
      "Secrets are managed under Settings → Secrets and are encrypted at rest. Components reference secrets by name at runtime.",
  },
  {
    id: "self-host",
    question: "Can I run Tangle against my own backend?",
    answer:
      "Yes. Under Settings → Backend you can point Tangle at any compatible backend URL — see the docs for self-hosting instructions.",
  },
];

function QuickLinkTile({ link }: { link: QuickLink }) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className="no-underline"
      {...tracking("learning_hub.documentation.quick_link", {
        link_id: link.id,
      })}
    >
      <InlineStack
        gap="2"
        blockAlign="center"
        className="px-3 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-muted/40 transition-all"
      >
        <Icon
          name={link.icon}
          size="sm"
          className="text-muted-foreground shrink-0"
          aria-hidden="true"
        />
        <Text size="sm" weight="semibold" className="truncate">
          {link.label}
        </Text>
        <div className="flex-1" />
        <Icon
          name="ExternalLink"
          size="xs"
          className="text-muted-foreground shrink-0"
          aria-hidden="true"
        />
      </InlineStack>
    </a>
  );
}

function FaqRow({ item }: { item: FaqItem }) {
  return (
    <Collapsible>
      <CollapsibleTrigger
        className="group w-full flex items-center justify-between gap-3 py-3 text-left cursor-pointer"
        {...tracking("learning_hub.documentation.faq_toggle", {
          faq_id: item.id,
        })}
      >
        <Text size="sm" weight="semibold">
          {item.question}
        </Text>
        <Icon
          name="ChevronDown"
          size="sm"
          className="text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Paragraph size="sm" tone="subdued" className="pb-3">
          {item.answer}
        </Paragraph>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DocumentationPanel() {
  return (
    <BlockStack gap="4">
      <InlineStack gap="2" blockAlign="center" align="space-between">
        <InlineStack gap="2" blockAlign="center">
          <Icon
            name="BookOpen"
            size="md"
            className="text-primary"
            aria-hidden="true"
          />
          <Heading level={2}>Documentation</Heading>
        </InlineStack>
        <a
          href={DOCUMENTATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
          {...tracking("learning_hub.documentation.full_docs")}
        >
          Full docs ↗
        </a>
      </InlineStack>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {QUICK_LINKS.map((link) => (
          <QuickLinkTile key={link.id} link={link} />
        ))}
      </div>

      <BlockStack gap="0" className="border-t border-border pt-2">
        <Text size="xs" tone="subdued" weight="semibold" className="pb-1">
          Frequently asked
        </Text>
        <BlockStack className="divide-y divide-border">
          {FAQ_ITEMS.map((item) => (
            <FaqRow key={item.id} item={item} />
          ))}
        </BlockStack>
      </BlockStack>
    </BlockStack>
  );
}
