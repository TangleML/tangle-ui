import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

interface FeaturedExample {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

const STUB_EXAMPLES: FeaturedExample[] = [
  {
    id: "xgboost",
    name: "XGBoost classification",
    description:
      "Train and evaluate an XGBoost model end-to-end with preprocessing and hyperparameter tuning.",
    tags: ["XGBoost", "Tabular"],
  },
  {
    id: "pytorch",
    name: "PyTorch neural network",
    description:
      "Build, train and evaluate a fully-connected network in PyTorch — data loading through metrics.",
    tags: ["PyTorch", "Deep Learning"],
  },
  {
    id: "vertex-automl",
    name: "Vertex AI AutoML",
    description:
      "Use Google Vertex AI AutoML to train tabular models without writing model code.",
    tags: ["AutoML", "Vertex AI"],
  },
];

export function FeaturedExamples() {
  return (
    <BlockStack gap="3">
      <InlineStack gap="3" align="space-between" blockAlign="center">
        <InlineStack gap="2" blockAlign="center">
          <Icon
            name="Sparkles"
            size="md"
            className="text-primary"
            aria-hidden="true"
          />
          <Heading level={2}>Example pipelines</Heading>
        </InlineStack>
        <Button
          asChild
          size="sm"
          variant="link"
          className="px-0"
          {...tracking("learning_hub.examples.browse_all")}
        >
          <Link to="/learn/examples">Browse all examples →</Link>
        </Button>
      </InlineStack>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STUB_EXAMPLES.map((example) => (
          <Link
            key={example.id}
            to="/learn/examples"
            className="no-underline"
            {...tracking("learning_hub.examples.item", {
              example_id: example.id,
            })}
          >
            <Card className="h-full hover:shadow-md hover:border-primary/40 transition-all duration-200 cursor-pointer">
              <CardHeader>
                <BlockStack gap="2">
                  <CardTitle className="text-base">{example.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {example.description}
                  </CardDescription>
                  <InlineStack gap="1" wrap="wrap">
                    {example.tags.map((tag) => (
                      <Badge key={tag} size="sm" variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </InlineStack>
                </BlockStack>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </BlockStack>
  );
}
