import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import { useEntity } from "@/models/componentSpec/hooks/useEntity";
import { useObservableArray } from "@/models/componentSpec/hooks/useObservableArray";
import { ObservableArray } from "@/models/componentSpec/reactive/observableArray";

import { ShoppingItem, ShoppingList } from "./entities";

const idGenerator = new IncrementingIdGenerator();

function ShoppingItemRow({
  item: originalItem,
  onRemove,
}: {
  item: ShoppingItem;
  onRemove: () => void;
}) {
  const item = useEntity(originalItem);

  console.log("ShoppingItemRow render", { originalItem, item });

  if (!item) return null;

  return (
    <InlineStack
      gap="3"
      blockAlign="center"
      className="py-2 px-3 bg-muted/30 rounded-md"
    >
      <Checkbox
        checked={item.done}
        onCheckedChange={(checked) => {
          // eslint-disable-next-line react-compiler/react-compiler -- Intentional mutation for reactive model
          originalItem.done = checked === true;
        }}
      />
      <BlockStack gap="0" className="flex-1 min-w-0">
        <Text
          size="sm"
          weight="semibold"
          className={item.done ? "line-through text-muted-foreground" : ""}
        >
          {item.name}
        </Text>
        {item.brand && (
          <Text size="xs" tone="subdued">
            {item.brand}
          </Text>
        )}
      </BlockStack>
      {item.price > 0 && (
        <Text size="sm" tone="subdued" font="mono">
          ${item.price.toFixed(2)}
        </Text>
      )}
      <Button variant="ghost" size="min" onClick={onRemove}>
        <Icon name="X" size="sm" />
      </Button>
    </InlineStack>
  );
}

function AddItemForm({ onAdd }: { onAdd: (item: ShoppingItem) => void }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const item = new ShoppingItem(idGenerator.next("item"), {
      name: name.trim(),
      brand: brand.trim() || undefined,
      price: price ? parseFloat(price) : undefined,
    });

    onAdd(item);
    setName("");
    setBrand("");
    setPrice("");
  };

  return (
    <form onSubmit={handleSubmit}>
      <InlineStack gap="2" blockAlign="end">
        <BlockStack gap="1" className="flex-1">
          <Text as="span" size="xs" tone="subdued">
            Name *
          </Text>
          <Input
            placeholder="Item name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </BlockStack>
        <BlockStack gap="1">
          <Text as="span" size="xs" tone="subdued">
            Brand
          </Text>
          <Input
            placeholder="Brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-28"
          />
        </BlockStack>
        <BlockStack gap="1">
          <Text as="span" size="xs" tone="subdued">
            Price
          </Text>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-20"
          />
        </BlockStack>
        <Button type="submit" size="sm">
          <Icon name="Plus" size="sm" />
          Add
        </Button>
      </InlineStack>
    </form>
  );
}

function ShoppingListCard({
  list: originalList,
  onRemove,
}: {
  list: ShoppingList;
  onRemove: () => void;
}) {
  // Subscribe to list changes AND child (item) changes via event bubbling
  const list = useEntity(originalList, { subscribeToChildren: true });
  const items = useObservableArray(originalList.items, {
    subscribeToChildren: true,
  });

  console.log("ShoppingListCard render", { originalList, list, items });

  if (!list) return null;

  const isDone = items.length > 0 && items.every((item) => item.done);

  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
  const completedCount = items.filter((item) => item.done).length;

  return (
    <Card
      className={
        isDone ? "border-green-500 bg-green-50/50 dark:bg-green-950/20" : ""
      }
    >
      <CardHeader>
        <InlineStack align="space-between" blockAlign="start">
          <BlockStack gap="1">
            <InlineStack gap="2" blockAlign="center">
              {isDone && <Icon name="CircleCheck" className="text-green-600" />}
              <CardTitle>
                {list.name} #{list.$id}
              </CardTitle>
            </InlineStack>
            <CardDescription>
              {list.dueDate
                ? `Due: ${list.dueDate.toLocaleDateString()}`
                : "No due date"}
              {" • "}
              {completedCount}/{items.length} items done
              {totalPrice > 0 && ` • Total: $${totalPrice.toFixed(2)}`}
            </CardDescription>
          </BlockStack>
          <Button variant="ghost" size="min" onClick={onRemove}>
            <Icon name="Trash2" size="sm" />
          </Button>
        </InlineStack>
      </CardHeader>
      <CardContent>
        <BlockStack gap="3">
          {items.length === 0 ? (
            <Text tone="subdued" size="sm" className="text-center py-4">
              No items yet. Add some items below.
            </Text>
          ) : (
            <BlockStack gap="2">
              {items.map((item, index) => (
                <ShoppingItemRow
                  key={item.$id}
                  item={item}
                  onRemove={() => originalList.items.remove(index)}
                />
              ))}
            </BlockStack>
          )}
          <AddItemForm onAdd={(item) => originalList.items.add(item)} />
        </BlockStack>
      </CardContent>
    </Card>
  );
}

function AddListForm({ onAdd }: { onAdd: (list: ShoppingList) => void }) {
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const list = new ShoppingList(idGenerator.next("list"), {
      name: name.trim(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    onAdd(list);
    setName("");
    setDueDate("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Shopping List</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <InlineStack gap="3" blockAlign="end">
            <BlockStack gap="1" className="flex-1">
              <Text as="span" size="xs" tone="subdued">
                List Name *
              </Text>
              <Input
                placeholder="e.g., Weekly Groceries"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </BlockStack>
            <BlockStack gap="1">
              <Text as="span" size="xs" tone="subdued">
                Due Date
              </Text>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-40"
              />
            </BlockStack>
            <Button type="submit">
              <Icon name="Plus" size="sm" />
              Create List
            </Button>
          </InlineStack>
        </form>
      </CardContent>
    </Card>
  );
}

export function Playground() {
  const [allLists] = useState(() => new ObservableArray<ShoppingList>());
  // Subscribe to both array changes AND child changes of all lists
  const lists = useObservableArray(allLists, { subscribeToChildren: true });

  const totalLists = lists.length;
  const completedLists = lists.filter((l) => l.isDone()).length;
  const totalItems = lists.reduce((sum, l) => sum + l.items.length, 0);
  const totalValue = lists.reduce(
    (sum, l) => sum + l.items.all.reduce((s, i) => s + i.price, 0),
    0,
  );

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <BlockStack gap="6">
        <BlockStack gap="2">
          <Text as="h1" size="2xl" weight="bold">
            Reactive Playground
          </Text>
          <Text tone="subdued">
            Testing the reactive object model with a shopping list application.
          </Text>
        </BlockStack>

        <InlineStack gap="4" className="p-4 bg-muted rounded-lg">
          <BlockStack gap="0" align="center">
            <Text size="2xl" weight="bold">
              {totalLists}
            </Text>
            <Text size="xs" tone="subdued">
              Lists
            </Text>
          </BlockStack>
          <BlockStack gap="0" align="center">
            <Text size="2xl" weight="bold">
              {completedLists}
            </Text>
            <Text size="xs" tone="subdued">
              Completed
            </Text>
          </BlockStack>
          <BlockStack gap="0" align="center">
            <Text size="2xl" weight="bold">
              {totalItems}
            </Text>
            <Text size="xs" tone="subdued">
              Items
            </Text>
          </BlockStack>
          <BlockStack gap="0" align="center">
            <Text size="2xl" weight="bold" font="mono">
              ${totalValue.toFixed(2)}
            </Text>
            <Text size="xs" tone="subdued">
              Total Value
            </Text>
          </BlockStack>
        </InlineStack>

        <AddListForm onAdd={(list) => allLists.add(list)} />

        {lists.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <BlockStack gap="2" align="center">
                <Icon
                  name="ShoppingCart"
                  size="xl"
                  className="text-muted-foreground"
                />
                <Text tone="subdued">
                  No shopping lists yet. Create one above to get started.
                </Text>
              </BlockStack>
            </CardContent>
          </Card>
        ) : (
          <BlockStack gap="4">
            {lists.map((list, index) => (
              <ShoppingListCard
                key={list.$id}
                list={list}
                onRemove={() => allLists.remove(index)}
              />
            ))}
          </BlockStack>
        )}
      </BlockStack>
    </div>
  );
}
