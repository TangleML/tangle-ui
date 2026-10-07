import { PipelineSection } from "@/components/Home/PipelineSection/PipelineSection";
import { BlockStack } from "@/components/ui/layout";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading } from "@/components/ui/typography";

import { FavoritesPreview } from "./FavoritesPreview";

export function DashboardPipelinesView() {
  return (
    <BlockStack gap="6">
      <FavoritesPreview
        title="Favorite Pipelines"
        typeFilter="pipeline"
        hideWhenEmpty
        trackingId="pipelines.favorites.item"
      />
      <BlockStack gap="4">
        <Heading level={2}>Pipelines</Heading>
        <Tabs defaultValue="local" className="w-full gap-4">
          <TabsList aria-label="Pipelines">
            <TabsTrigger value="local">Local Pipelines</TabsTrigger>
            <TabsTrigger value="remote">Remote Pipelines</TabsTrigger>
          </TabsList>
          <TabsContent value="local">
            <PipelineSection />
          </TabsContent>
          <TabsContent value="remote">
            <Table aria-label="Remote Pipelines">
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead scope="col">Name</TableHead>
                  <TableHead scope="col">ID</TableHead>
                  <TableHead scope="col">User</TableHead>
                  <TableHead scope="col">Created at</TableHead>
                  <TableHead scope="col">Updated at</TableHead>
                  <TableHead scope="col">Current version</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody />
            </Table>
          </TabsContent>
        </Tabs>
      </BlockStack>
    </BlockStack>
  );
}
