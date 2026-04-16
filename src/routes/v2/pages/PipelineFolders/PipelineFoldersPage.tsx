import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";
import { PipelineFolders } from "@/routes/v2/pages/PipelineFolders/PipelineFolders";

export function PipelineFoldersPage() {
  return (
    <div className="container mx-auto w-3/4 p-4 flex flex-col gap-4">
      <InlineStack gap="2" blockAlign="center">
        <Icon name="FolderOpen" size="lg" className="text-stone-500" />
        <Heading level={1}>Open Pipeline</Heading>
      </InlineStack>
      <PipelineFolders />
    </div>
  );
}
