import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface TimeProps {
  day: number;
  onAdvanceDay: () => void;
}

const Time = ({ day, onAdvanceDay }: TimeProps) => {
  return (
    <BlockStack gap="1">
      <Text>Day {day}</Text>
      <InlineStack className="px-2">
        <Button onClick={onAdvanceDay} className="w-full" size="sm">
          Next Day
        </Button>
      </InlineStack>
    </BlockStack>
  );
};

export default Time;
