import { Button } from "@/components/ui/button";
import { InlineStack } from "@/components/ui/layout";
import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";

interface TimeProps {
  day: number;
  onAdvanceDay: () => void;
}

const Time = ({ day, onAdvanceDay }: TimeProps) => {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Day {day}</SidebarGroupLabel>
      <InlineStack className="px-2">
        <Button onClick={onAdvanceDay} className="w-full" size="sm">
          Next Day
        </Button>
      </InlineStack>
    </SidebarGroup>
  );
};

export default Time;
