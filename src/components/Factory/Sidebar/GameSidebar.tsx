import { Sidebar, SidebarContent } from "@/components/ui/sidebar";

import Buildings from "./Buildings";
import Resources from "./Resources";
import Time from "./Time";

interface GameSidebarProps {
  day: number;
  coins: number;
  knowledge: number;
  onAdvanceDay: () => void;
}

const GameSidebar = ({
  day,
  coins,
  knowledge,
  onAdvanceDay,
}: GameSidebarProps) => {
  return (
    <Sidebar
      side="left"
      className="mt-14 h-[calc(100vh-56px)]"
      collapsible="icon"
    >
      <SidebarContent>
        <Time day={day} onAdvanceDay={onAdvanceDay} />
        <Resources coins={coins} knowledge={knowledge} />
        <Buildings />
      </SidebarContent>
    </Sidebar>
  );
};

export default GameSidebar;
