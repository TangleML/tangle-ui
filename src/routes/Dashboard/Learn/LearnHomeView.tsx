import { DocumentationPanel } from "@/components/Learn/DocumentationPanel";
import { FeaturedExamples } from "@/components/Learn/FeaturedExamples";
import { FeaturedTours } from "@/components/Learn/FeaturedTours";
import { LearnPageHeader } from "@/components/Learn/LearnPageHeader";
import { LearnSearchBar } from "@/components/Learn/LearnSearchBar";
import { OnboardingHero } from "@/components/Learn/OnboardingHero";
import { TipOfTheDay } from "@/components/Learn/TipOfTheDay";
import { BlockStack } from "@/components/ui/layout";

export function LearnHomeView() {
  return (
    <BlockStack gap="6">
      <BlockStack gap="4">
        <LearnPageHeader
          title="Learning Hub"
          description="Everything you need to get the most out of Tangle — onboarding, docs, examples, tips and tours, all in one place."
          icon="GraduationCap"
        />
        <LearnSearchBar />
      </BlockStack>

      <OnboardingHero />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TipOfTheDay />
        <FeaturedTours />
      </div>

      <FeaturedExamples />

      <DocumentationPanel />
    </BlockStack>
  );
}
