import type { IconName } from "@/components/ui/icon";

import toursData from "./tours.json";

export type TourDifficulty = "Beginner" | "Intermediate" | "Advanced";

export interface Tour {
  id: string;
  title: string;
  description: string;
  difficulty: TourDifficulty;
  duration: string;
  area: string;
}

export const tours = toursData as Tour[];

export const TOUR_DIFFICULTY_ORDER: TourDifficulty[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
];

export const TOUR_DIFFICULTY_ICONS: Record<TourDifficulty, IconName> = {
  Beginner: "Sprout",
  Intermediate: "Mountain",
  Advanced: "Trophy",
};

export const TOUR_DIFFICULTY_COLORS: Record<TourDifficulty, string> = {
  Beginner: "text-emerald-500",
  Intermediate: "text-amber-500",
  Advanced: "text-violet-500",
};

export const TOUR_DIFFICULTY_BLURBS: Record<TourDifficulty, string> = {
  Beginner: "Start here. No prior knowledge required.",
  Intermediate: "Layer in workflows that build on the basics.",
  Advanced: "Complex features and edge cases worth knowing.",
};
