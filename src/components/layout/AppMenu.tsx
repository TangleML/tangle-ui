import { useParams } from "@tanstack/react-router";

import logo from "/Tangle_white.png";
import { ClonePipelineButton } from "@/components/PipelineRun/components/ClonePipelineButton";
import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { TopBarAuthentication } from "@/components/shared/Authentication/TopBarAuthentication";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import ImportPipeline from "@/components/shared/ImportPipeline";
import { InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { TOP_NAV_HEIGHT } from "@/utils/constants";

import BackendStatus from "../shared/BackendStatus";
import NewPipelineButton from "../shared/NewPipelineButton";
import { PersonalPreferences } from "../shared/Settings/PersonalPreferences";

const AppMenu = () => {
  const requiresAuthorization = isAuthorizationRequired();
  const { componentSpec } = useComponentSpec();
  const title = componentSpec?.name;
  const params = useParams({ strict: false });

  const runId =
    "id" in params && typeof params.id === "string" ? params.id : null;
  const isRunPage = runId !== null;

  return (
    <div
      className="w-full bg-stone-900 px-3 py-2.5 md:px-4"
      style={{ height: `${TOP_NAV_HEIGHT}px` }}
    >
      <InlineStack align="space-between" wrap="nowrap">
        <InlineStack gap="8" wrap="nowrap" className="min-w-0 flex-1">
          <Link href="/" aria-label="Home" variant="block" className="shrink-0">
            <img
              src={logo}
              alt="logo"
              className="h-8 filter cursor-pointer shrink-0"
            />
          </Link>

          {title && (
            <CopyText className="text-white text-md font-bold truncate max-w-32 sm:max-w-48 md:max-w-64 lg:max-w-md">
              {title}
            </CopyText>
          )}
        </InlineStack>

        <InlineStack gap="2" wrap="nowrap" className="shrink-0">
          {isRunPage && componentSpec && (
            <ClonePipelineButton componentSpec={componentSpec} runId={runId} />
          )}
          <ImportPipeline />
          <NewPipelineButton />
          <BackendStatus />
          <PersonalPreferences />
          {requiresAuthorization && <TopBarAuthentication />}
        </InlineStack>
      </InlineStack>
    </div>
  );
};

export default AppMenu;
