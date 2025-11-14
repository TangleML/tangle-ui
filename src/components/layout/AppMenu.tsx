import { Link } from "@tanstack/react-router";

import logoAsset from "@/assets/logo.png";
import ImportPipeline from "@/components/shared/ImportPipeline";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { TOP_NAV_HEIGHT } from "@/utils/constants";

import BackendStatus from "../shared/BackendStatus";
import CloneRunButton from "../shared/CloneRunButton";
import NewPipelineButton from "../shared/NewPipelineButton";
import { PersonalPreferences } from "../shared/Settings/PersonalPreferences";

const AppMenu = () => {
  const { componentSpec } = useComponentSpec();
  const title = componentSpec?.name;
  return (
    <div
      className="w-full bg-stone-900 p-2"
      style={{ height: `${TOP_NAV_HEIGHT}px` }}
    >
      <div className="flex justify-between items-center w-full mx-auto px-8">
        <div className="flex flex-row gap-2 items-center">
          <Link to="/">
            <img
              src={logoAsset}
              alt="logo"
              className="w-10 h-10 filter cursor-pointer"
            />
          </Link>
          <span className="text-white text-sm font-bold">{title}</span>
        </div>
        <div className="flex flex-row gap-32 items-center">
          <div className="flex flex-row gap-2 items-center">
            <CloneRunButton componentSpec={componentSpec} />
            <ImportPipeline />
            <NewPipelineButton />
          </div>

          <div className="flex flex-row gap-1 items-center">
            <BackendStatus />
            <PersonalPreferences />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppMenu;
