import "@/styles/editor.css";

import { Background, MiniMap, type ReactFlowProps } from "@xyflow/react";
import { useState } from "react";

import { CollapsibleContextPanel } from "@/components/shared/ContextPanel/CollapsibleContextPanel";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ContextPanelProvider } from "@/providers/ContextPanelProvider";

import GameCanvas from "./Canvas/GameCanvas";
import GameControls from "./Controls/GameControls";
import GameSidebar from "./Sidebar/GameSidebar";

const GRID_SIZE = 10;

const FactoryGame = () => {
  const [flowConfig, setFlowConfig] = useState<ReactFlowProps>({
    snapGrid: [GRID_SIZE, GRID_SIZE],
    snapToGrid: true,
    panOnDrag: true,
    selectionOnDrag: false,
    nodesDraggable: true,
  });

  const [day, setDay] = useState(0);
  const [coins, setCoins] = useState(0);
  const [knowledge, setKnowledge] = useState(0);
  const [advanceTrigger, setAdvanceTrigger] = useState(0);

  const updateFlowConfig = (updatedConfig: Partial<ReactFlowProps>) => {
    setFlowConfig((prevConfig) => ({
      ...prevConfig,
      ...updatedConfig,
    }));
  };

  const handleAdvanceDay = () => {
    setDay((prev) => prev + 1);
    setAdvanceTrigger((prev) => prev + 1);
  };

  const handleDayAdvance = (globalOutputs: {
    coins: number;
    knowledge: number;
  }) => {
    setCoins((prev) => prev + globalOutputs.coins);
    setKnowledge((prev) => prev + globalOutputs.knowledge);
  };

  return (
    <ContextPanelProvider defaultContent={<p>Factory Game</p>}>
      <InlineStack fill>
        <GameSidebar
          day={day}
          coins={coins}
          knowledge={knowledge}
          onAdvanceDay={handleAdvanceDay}
        />
        <BlockStack fill className="flex-1 relative">
          <GameCanvas
            {...flowConfig}
            onDayAdvance={handleDayAdvance}
            triggerAdvance={advanceTrigger}
          >
            <MiniMap position="bottom-left" pannable />
            <GameControls
              className="ml-56! mb-6!"
              config={flowConfig}
              updateConfig={updateFlowConfig}
              showInteractive={false}
            />
            <Background gap={GRID_SIZE} className="bg-slate-50!" />
          </GameCanvas>
        </BlockStack>
        <CollapsibleContextPanel />
      </InlineStack>
    </ContextPanelProvider>
  );
};

export default FactoryGame;
