import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";

import { useGameActions } from "../providers/GameActionsProvider";

export const FactoryContext = () => {
  const { restartGame } = useGameActions();

  return (
    <BlockStack gap={2} className="p-4">
      <h2 className="text-lg font-bold mb-2">Factory Game</h2>
      <p>How long can you survive?</p>
      <p>
        Every day that passes an increasing amount of food will be required for
        survival.
      </p>
      <p>
        Produce, refine and sell resources to earn money and expand your
        production lines.
      </p>
      <p>The game is autosaved at the end of every day.</p>
      <p>Happy Hack Days! - The factory must grow!</p>

      <Button onClick={restartGame} variant="destructive" className="mt-4">
        Restart Game
      </Button>
    </BlockStack>
  );
};
