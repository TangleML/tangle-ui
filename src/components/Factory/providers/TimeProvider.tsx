import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const TICK_INTERVAL = 40; // ~25fps
const MAX_PROGRESS = 1000;
const BASE_DAY_DURATION = 5000; // ms
const BASE_INCREMENT = MAX_PROGRESS / (BASE_DAY_DURATION / TICK_INTERVAL);
const DAY_TRANSITION_PAUSE = 200; // ms pause between days

const GAME_SPEED_MULTIPLIER = {
  slow: 1,
  medium: 2,
  fast: 5,
} as const;

export type GameSpeed = keyof typeof GAME_SPEED_MULTIPLIER;

interface TimeContextType {
  progress: number;
  isPaused: boolean;
  gameSpeed: GameSpeed;
  isTransitioning: boolean;
  dayAdvanceTrigger: number;
  togglePause: () => void;
  pause: () => void;
  resume: () => void;
  setGameSpeed: (speed: GameSpeed) => void;
  skipDay: () => void;
}

const TimeContext = createContext<TimeContextType | undefined>(undefined);

interface TimeProviderProps {
  children: React.ReactNode;
}

export const TimeProvider: React.FC<TimeProviderProps> = ({ children }) => {
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [gameSpeed, setGameSpeed] = useState<GameSpeed>("slow");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [dayAdvanceTrigger, setDayAdvanceTrigger] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  const pause = () => {
    setIsPaused(true);
  };

  const resume = () => {
    setIsPaused(false);
  };

  const advanceDay = () => {
    if (isTransitioning) return;

    setIsTransitioning(true);
    setProgress(0);

    setTimeout(() => {
      setDayAdvanceTrigger((prev) => prev + 1);
      setIsTransitioning(false);
    }, DAY_TRANSITION_PAUSE);
  };

  const skipDay = () => {
    advanceDay();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        togglePause();
      }

      if (event.key === "1") {
        setGameSpeed("slow");
      } else if (event.key === "2") {
        setGameSpeed("medium");
      } else if (event.key === "3") {
        setGameSpeed("fast");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  // Progress timer
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isPaused || isTransitioning) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const speedMultiplier = GAME_SPEED_MULTIPLIER[gameSpeed];
        const increment = BASE_INCREMENT * speedMultiplier;
        const newProgress = prev + increment;

        if (newProgress >= MAX_PROGRESS) {
          advanceDay(); // ✅ Advance day when progress completes
          return 0;
        }

        return newProgress;
      });
    }, TICK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused, gameSpeed, isTransitioning]);

  return (
    <TimeContext.Provider
      value={{
        progress,
        isPaused,
        gameSpeed,
        isTransitioning,
        dayAdvanceTrigger,
        togglePause,
        pause,
        resume,
        setGameSpeed,
        skipDay,
      }}
    >
      {children}
    </TimeContext.Provider>
  );
};

export const useTime = () => {
  const context = useContext(TimeContext);
  if (!context) {
    throw new Error("useTime must be used within a TimeProvider");
  }
  return context;
};
