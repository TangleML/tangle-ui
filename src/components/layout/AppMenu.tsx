import { Link } from "@tanstack/react-router";

import logo from "/public/Tangle_white.png";
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
      className="w-full bg-stone-900 p-2 pt-2.5"
      style={{ height: `${TOP_NAV_HEIGHT}px` }}
    >
      <InlineStack
        blockAlign="center"
        align="space-between"
        className="pl-12 pr-2"
      >
        <InlineStack blockAlign="center">
          <Link to="/">
            <img
              src={logo}
              alt="logo"
              className="h-8 filter cursor-pointer shrink-0"
            />
          </Link>
          <span className="text-white text-md font-bold ml-22">{title}</span>
        </InlineStack>

        <InlineStack blockAlign="center">
          <InlineStack gap="4" blockAlign="center" className="mr-42">
            <CloneRunButton componentSpec={componentSpec} />
            <ImportPipeline />
            <NewPipelineButton />
          </InlineStack>

          <InlineStack gap="2" blockAlign="center">
            <BackendStatus />
            <PersonalPreferences />
            {requiresAuthorization && <TopBarAuthentication />}
          </InlineStack>
        </InlineStack>
      </InlineStack>
    </div>
  );
};

export default AppMenu;
