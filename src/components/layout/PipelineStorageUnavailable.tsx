import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";

/**
 * Shown instead of the app when the deployment stores pipelines outside the
 * browser and the page did not provide that store. Everything here reads and
 * writes pipelines, so carrying on would either show an empty library or save
 * work where nobody will look for it.
 */
export function PipelineStorageUnavailable() {
  return (
    <BlockStack
      align="center"
      gap="4"
      fill
      className="min-h-screen p-8 text-center"
      data-testid="pipeline-storage-unavailable"
    >
      <Icon name="DatabaseZap" size="lg" className="text-destructive" />
      <Heading level={1}>Pipeline storage is not available</Heading>
      <Paragraph tone="subdued" className="max-w-prose">
        This deployment keeps your pipelines outside the browser, and that store
        did not load. Nothing has been lost — reload to try again, and if it
        keeps happening, report it rather than working around it.
      </Paragraph>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </BlockStack>
  );
}
