import { ReactFlowProvider } from "@xyflow/react";

import FactoryGameApp from "./FactoryGameApp";
import { GlobalResourcesProvider } from "./providers/GlobalResourcesProvider";
import { StatisticsProvider } from "./providers/StatisticProvider";

/**
 * FactoryGame - Top-level component that provides all necessary contexts
 * This component sets up the provider hierarchy for the factory game
 */
const FactoryGame = () => {
  return (
    <ReactFlowProvider>
      <GlobalResourcesProvider>
        <StatisticsProvider>
          <FactoryGameApp />
        </StatisticsProvider>
      </GlobalResourcesProvider>
    </ReactFlowProvider>
  );
};

export default FactoryGame;
