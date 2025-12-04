import type { ReactNode } from "react";
import { FaPython } from "react-icons/fa";
import { SiGnubash, SiRuby } from "react-icons/si";
import { TbBrandJavascript } from "react-icons/tb";

import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";

import type { SupportedTemplate } from "../types";

export const NewComponentTemplateSelector = ({
  onTemplateSelected,
}: {
  onTemplateSelected: (templateName: SupportedTemplate) => void;
}) => {
  return (
    <BlockStack gap="2" className="py-4">
      <Heading level={2}>New Component</Heading>
      <Paragraph tone="subdued">
        Create a new component using the in-app editor
      </Paragraph>
      <Heading level={3}>Select a Template</Heading>
      <div className="grid grid-cols-3 border rounded-md p-2 w-full">
        {SUPPORTED_TEMPLATES.map((template) => (
          <Button
            key={template.name}
            variant="ghost"
            className="p-0 h-full w-full"
            onClick={() => onTemplateSelected(template.templateName)}
            data-testid={`new-component-template-selector-option-${template.templateName}`}
          >
            <BlockStack
              gap="1"
              align="center"
              inlineAlign="space-between"
              className="p-2"
            >
              <InlineStack
                align="center"
                blockAlign="center"
                className="bg-gray-200 rounded-md p-4 mb-2 w-full h-24"
              >
                {!!template.icon && template.icon}
              </InlineStack>
              <Paragraph>{template.name}</Paragraph>
            </BlockStack>
          </Button>
        ))}
      </div>
    </BlockStack>
  );
};

type Template = {
  name: string;
  icon?: ReactNode;
  color?: string;
  templateName: SupportedTemplate;
};

const SUPPORTED_TEMPLATES: Template[] = [
  {
    name: "Python",
    icon: <FaPython size={48} className="text-green-400 scale-300" />,
    color: "text-green-400",
    templateName: "python",
  },
  {
    name: "Bash",
    icon: <SiGnubash size={48} className="text-gray-400 scale-300" />,
    color: "text-gray-400",
    templateName: "bash",
  },
  {
    name: "JavaScript",
    icon: <TbBrandJavascript size={48} className="text-yellow-400 scale-300" />,
    color: "text-yellow-400",
    templateName: "javascript",
  },
  {
    name: "Ruby",
    icon: <SiRuby size={48} className="text-red-400 scale-300" />,
    color: "text-red-400",
    templateName: "ruby",
  },
  { name: "Empty", templateName: "empty" },
];
