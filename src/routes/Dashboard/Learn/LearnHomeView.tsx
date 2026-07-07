import { DocsQuickLinks } from "@/components/Learn/DocsQuickLinks";
import { FaqPanel } from "@/components/Learn/FaqPanel";
import { FeaturedExamples } from "@/components/Learn/FeaturedExamples";
import { FeaturedTours } from "@/components/Learn/FeaturedTours";
import { HelpCard } from "@/components/Learn/HelpCard";
import { LearnPageHeader } from "@/components/Learn/LearnPageHeader";
import { LearnSearchBar } from "@/components/Learn/LearnSearchBar";
import { OnboardingHero } from "@/components/Learn/OnboardingHero";
import { TipOfTheDay } from "@/components/Learn/TipOfTheDay";
import { BlockStack } from "@/components/ui/layout";

// Learning Hub Milestone 1: Documentation, FAQ, Example Pipelines & Tips
// Not included: Guided Tours & Onboarding
const SHOW_WIP_FEATURES = false;

export function LearnHomeView() {
  return (
    <BlockStack gap="6">
      <BlockStack gap="4">
        <LearnPageHeader
          title="Learning Hub"
          description="Everything you need to get the most out of Tangle, all in one place."
          icon="GraduationCap"
        />
        <BlockStack gap="3">
          <LearnSearchBar />
          <DocsQuickLinks />
        </BlockStack>
      </BlockStack>

      {SHOW_WIP_FEATURES && <OnboardingHero />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TipOfTheDay />
        <FeaturedTours />
      </div>

      <FeaturedExamples />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start w-full">
        <div className="lg:col-span-2">
          <FaqPanel />
        </div>
        <div className="lg:col-span-2 w-full flex justify-center lg:sticky lg:top-[calc(50vh-5rem)]">
          <HelpCard />
        </div>
      </div>
    </BlockStack>
  );
}
