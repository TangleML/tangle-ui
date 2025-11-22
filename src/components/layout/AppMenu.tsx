import { Link } from "@tanstack/react-router";

import logoAsset from "@/assets/logo.png";
import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { TopBarAuthentication } from "@/components/shared/Authentication/TopBarAuthentication";
import ImportPipeline from "@/components/shared/ImportPipeline";
import { InlineStack } from "@/components/ui/layout";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { TOP_NAV_HEIGHT } from "@/utils/constants";

import BackendStatus from "../shared/BackendStatus";
import CloneRunButton from "../shared/CloneRunButton";
import NewPipelineButton from "../shared/NewPipelineButton";
import { PersonalPreferences } from "../shared/Settings/PersonalPreferences";

const AppMenu = () => {
  const requiresAuthorization = isAuthorizationRequired();
  const { componentSpec } = useComponentSpec();
  const title = componentSpec?.name;
  return (
    <div
      className="w-full bg-stone-900 p-2"
      style={{ height: `${TOP_NAV_HEIGHT}px` }}
    >
      <div className="flex justify-between items-center w-full mx-auto pl-8 pr-2">
        <div className="flex flex-row gap-2 items-center shrink-0 w-[50%]">
          <Link to="/">
            <img
              src={logoAsset}
              alt="logo"
              className="w-10 h-10 filter cursor-pointer shrink-0"
            />
          </Link>
          <span className="text-white text-sm font-bold">{title}</span>
        </div>
        <InlineStack
          blockAlign="center"
          align="space-between"
          className="w-full"
        >
          <div className="flex flex-row gap-2 items-center">
            <CloneRunButton componentSpec={componentSpec} />
            <ImportPipeline />
            <NewPipelineButton />
          </div>

          <InlineStack blockAlign="center" gap="2">
            <BackendStatus />
            <PersonalPreferences />
            {requiresAuthorization && <TopBarAuthentication />}
          </InlineStack>
        </InlineStack>
      </div>
    </div>
  );
};

export default AppMenu;
