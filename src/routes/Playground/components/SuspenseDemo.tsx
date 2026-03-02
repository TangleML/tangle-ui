import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { action, observable } from "mobx";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/typography";

const waitFor = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// MobX store for demonstrating reactivity inside suspense-wrapped components
// ---------------------------------------------------------------------------

class SuspenseDemoStore {
  @observable accessor useFahrenheit = true;
  @observable accessor showAuthor = true;
  @observable accessor compactStats = false;

  @action toggleUnit() {
    this.useFahrenheit = !this.useFahrenheit;
  }

  @action toggleAuthor() {
    this.showAuthor = !this.showAuthor;
  }

  @action toggleCompact() {
    this.compactStats = !this.compactStats;
  }
}

// ---------------------------------------------------------------------------
// Skeleton fallbacks
// ---------------------------------------------------------------------------

function WeatherWidgetSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton size="lg" />
        <Skeleton size="sm" />
      </CardHeader>
      <CardContent>
        <BlockStack gap="3">
          <Skeleton className="h-10 w-20" />
          <Skeleton size="full" />
          <Skeleton size="half" />
        </BlockStack>
      </CardContent>
    </Card>
  );
}

function QuoteCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton size="lg" />
      </CardHeader>
      <CardContent>
        <BlockStack gap="3">
          <Skeleton size="full" />
          <Skeleton size="full" />
          <Skeleton size="half" />
        </BlockStack>
      </CardContent>
    </Card>
  );
}

function StatsPanelSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton size="lg" />
      </CardHeader>
      <CardContent>
        <InlineStack gap="4">
          {Array.from({ length: 3 }, (_, i) => (
            <BlockStack key={i} gap="2" className="flex-1">
              <Skeleton size="sm" />
              <Skeleton className="h-8 w-full" />
            </BlockStack>
          ))}
        </InlineStack>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Suspense-wrapped observer components
// ---------------------------------------------------------------------------

const WeatherWidgetInner = observer(function WeatherWidgetInner({
  store,
}: {
  store: SuspenseDemoStore;
}) {
  const { data } = useSuspenseQuery({
    queryKey: ["playground", "weather"],
    queryFn: async () => {
      await waitFor(2500);
      return {
        tempCelsius: 22,
        condition: "Sunny",
        location: "San Francisco",
        humidity: 65,
        wind: 12,
      };
    },
  });

  const displayTemp = store.useFahrenheit
    ? `${Math.round(data.tempCelsius * 1.8 + 32)}°F`
    : `${data.tempCelsius}°C`;

  return (
    <Card>
      <CardHeader>
        <InlineStack gap="2" blockAlign="center">
          <Icon name="Sun" className="text-amber-500" />
          <CardTitle>Weather</CardTitle>
        </InlineStack>
        <CardDescription>{data.location}</CardDescription>
      </CardHeader>
      <CardContent>
        <BlockStack gap="3">
          <Text size="2xl" weight="bold" font="mono">
            {displayTemp}
          </Text>
          <Text size="sm">{data.condition}</Text>
          <InlineStack gap="4">
            <Text size="xs" tone="subdued">
              Humidity: {data.humidity}%
            </Text>
            <Text size="xs" tone="subdued">
              Wind: {data.wind} km/h
            </Text>
          </InlineStack>
        </BlockStack>
      </CardContent>
    </Card>
  );
});

const WeatherWidget = withSuspenseWrapper(
  WeatherWidgetInner,
  WeatherWidgetSkeleton,
);

const QuoteCardInner = observer(function QuoteCardInner({
  store,
}: {
  store: SuspenseDemoStore;
}) {
  const { data } = useSuspenseQuery({
    queryKey: ["playground", "quote"],
    queryFn: async () => {
      await waitFor(2500);
      return {
        text: "The only way to do great work is to love what you do.",
        author: "Steve Jobs",
        category: "Motivation",
      };
    },
  });

  return (
    <Card>
      <CardHeader>
        <InlineStack gap="2" blockAlign="center">
          <Icon name="Quote" className="text-blue-500" />
          <CardTitle>Quote of the Day</CardTitle>
        </InlineStack>
        <CardDescription>{data.category}</CardDescription>
      </CardHeader>
      <CardContent>
        <BlockStack gap="3">
          <Text size="sm" className="italic">
            &ldquo;{data.text}&rdquo;
          </Text>
          {store.showAuthor && (
            <Text size="xs" tone="subdued" weight="semibold">
              &mdash; {data.author}
            </Text>
          )}
        </BlockStack>
      </CardContent>
    </Card>
  );
});

const QuoteCard = withSuspenseWrapper(QuoteCardInner, QuoteCardSkeleton);

const StatsPanelInner = observer(function StatsPanelInner({
  store,
}: {
  store: SuspenseDemoStore;
}) {
  const { data } = useSuspenseQuery({
    queryKey: ["playground", "stats"],
    queryFn: async () => {
      await waitFor(2500);
      return {
        uptime: "14d 6h 32m",
        requests: 1_284_930,
        errorRate: 0.12,
        avgLatency: 42,
        activeUsers: 847,
        cpuUsage: 63,
      };
    },
  });

  const stats = store.compactStats
    ? [
        { label: "Uptime", value: data.uptime },
        { label: "Requests", value: data.requests.toLocaleString() },
        { label: "Errors", value: `${data.errorRate}%` },
      ]
    : [
        { label: "Uptime", value: data.uptime },
        { label: "Requests", value: data.requests.toLocaleString() },
        { label: "Error Rate", value: `${data.errorRate}%` },
        { label: "Avg Latency", value: `${data.avgLatency}ms` },
        { label: "Active Users", value: data.activeUsers.toLocaleString() },
        { label: "CPU", value: `${data.cpuUsage}%` },
      ];

  return (
    <Card>
      <CardHeader>
        <InlineStack gap="2" blockAlign="center">
          <Icon name="Activity" className="text-green-500" />
          <CardTitle>System Stats</CardTitle>
        </InlineStack>
        <CardDescription>
          {store.compactStats ? "Compact view" : "Full view"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <BlockStack key={stat.label} gap="1" align="center">
              <Text size="xs" tone="subdued">
                {stat.label}
              </Text>
              <Text size="sm" weight="bold" font="mono">
                {stat.value}
              </Text>
            </BlockStack>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

const StatsPanel = withSuspenseWrapper(StatsPanelInner, StatsPanelSkeleton);

// ---------------------------------------------------------------------------
// Controls & container
// ---------------------------------------------------------------------------

const DemoControls = observer(function DemoControls({
  store,
  onReload,
}: {
  store: SuspenseDemoStore;
  onReload: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <InlineStack align="space-between" blockAlign="center">
          <CardTitle>Controls</CardTitle>
          <Button variant="outline" size="sm" onClick={onReload}>
            <Icon name="RotateCcw" size="sm" />
            Reload All
          </Button>
        </InlineStack>
        <CardDescription>
          Toggle MobX observables to verify reactivity inside suspense-wrapped
          components.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InlineStack gap="6">
          <InlineStack gap="2" blockAlign="center">
            <Switch
              checked={store.useFahrenheit}
              onCheckedChange={() => store.toggleUnit()}
            />
            <Text size="sm">Fahrenheit</Text>
          </InlineStack>
          <InlineStack gap="2" blockAlign="center">
            <Switch
              checked={store.showAuthor}
              onCheckedChange={() => store.toggleAuthor()}
            />
            <Text size="sm">Show Author</Text>
          </InlineStack>
          <InlineStack gap="2" blockAlign="center">
            <Switch
              checked={store.compactStats}
              onCheckedChange={() => store.toggleCompact()}
            />
            <Text size="sm">Compact Stats</Text>
          </InlineStack>
        </InlineStack>
      </CardContent>
    </Card>
  );
});

export function SuspenseDemo() {
  const [store] = useState(() => new SuspenseDemoStore());
  const queryClient = useQueryClient();

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: ["playground"] });
  };

  return (
    <BlockStack gap="4">
      <DemoControls store={store} onReload={handleReload} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WeatherWidget store={store} />
        <QuoteCard store={store} />
      </div>
      <StatsPanel store={store} />
    </BlockStack>
  );
}
