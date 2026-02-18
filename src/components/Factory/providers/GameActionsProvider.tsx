import { createContext, type ReactNode, useContext, useRef } from "react";

interface GameActionsContextType {
  restartGame: () => void;
  registerRestartHandler: (handler: () => void) => void;
}

const GameActionsContext = createContext<GameActionsContextType | undefined>(
  undefined,
);

interface GameActionsProviderProps {
  children: ReactNode;
}

export const GameActionsProvider = ({ children }: GameActionsProviderProps) => {
  const restartHandlerRef = useRef<(() => void) | null>(null);

  const registerRestartHandler = (handler: () => void) => {
    restartHandlerRef.current = handler;
  };

  const restartGame = () => {
    if (restartHandlerRef.current) {
      restartHandlerRef.current();
    }
  };

  return (
    <GameActionsContext.Provider
      value={{
        restartGame,
        registerRestartHandler,
      }}
    >
      {children}
    </GameActionsContext.Provider>
  );
};

export const useGameActions = () => {
  const context = useContext(GameActionsContext);
  if (!context) {
    throw new Error("useGameActions must be used within GameActionsProvider");
  }
  return context;
};
