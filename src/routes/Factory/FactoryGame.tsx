import "@/styles/editor.css";

import { DndContext } from "@dnd-kit/core";
import { ReactFlowProvider } from "@xyflow/react";

import FactoryGame from "@/components/Factory/FactoryGame";

const Factory = () => {
  return (
    <DndContext>
      <ReactFlowProvider>
        <FactoryGame />
      </ReactFlowProvider>
    </DndContext>
  );
};

export default Factory;
