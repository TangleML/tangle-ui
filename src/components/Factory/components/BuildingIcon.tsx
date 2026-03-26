import { icons } from "lucide-react";

import { Icon, type IconName } from "@/components/ui/icon";

interface BuildingIconProps {
  icon: string;
}

const BuildingIcon = ({ icon }: BuildingIconProps) => {
  const isLucideIcon = icon in icons;

  if (isLucideIcon) {
    return <Icon name={icon as IconName} className="rotate-90" size="xl" />;
  }

  return <span className="text-xl shrink-0">{icon}</span>;
};

export default BuildingIcon;
