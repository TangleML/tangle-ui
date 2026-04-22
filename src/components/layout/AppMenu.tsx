import {
  Link as RouterLink,
  useLocation,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";

import logo from "/Tangle_white.png";
import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { TopBarAuthentication } from "@/components/shared/Authentication/TopBarAuthentication";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import ImportPipeline from "@/components/shared/ImportPipeline";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { APP_ROUTES } from "@/routes/router";
import { DOCUMENTATION_URL, TOP_NAV_HEIGHT } from "@/utils/constants";

import TooltipButton from "../shared/Buttons/TooltipButton";
import NewPipelineButton from "../shared/NewPipelineButton";

const DefaultAppMenu = () => {
  const router = useRouter();
  const location = useLocation();

  const requiresAuthorization = isAuthorizationRequired();
  const { componentSpec } = useComponentSpec();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const title = componentSpec?.name;

  const handleGoBack = () => {
    router.history.back();
  };

  const isOnSettingsRoute = location.pathname.startsWith("/settings");

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

        <InlineStack
          gap="2"
          wrap="nowrap"
          className="shrink-0"
          data-testid="app-menu-actions"
        >
          {/* Pipeline actions - desktop only */}
          <div className="hidden md:flex items-center gap-2">
            <ImportPipeline
              triggerComponent={
                <TooltipButton tooltip="Import Pipeline">
                  <Icon name="Upload" />
                </TooltipButton>
              }
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <NewPipelineButton>
                    <Icon name="Plus" />
                  </NewPipelineButton>
                </TooltipTrigger>
                <TooltipContent>New Pipeline</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="w-px h-5 bg-stone-700" />
          </div>

          {/* Settings & status */}
          {isOnSettingsRoute ? (
            <TooltipButton
              tooltip="Close Settings"
              onClick={handleGoBack}
              className="relative"
            >
              <Icon name="Settings" />
              <Icon
                name="X"
                size="xs"
                className="absolute bottom-1.5 right-1.5 bg-foreground rounded-full"
              />
            </TooltipButton>
          ) : (
            <RouterLink to="/settings/backend">
              <TooltipButton tooltip="Settings">
                <Icon name="Settings" />
              </TooltipButton>
            </RouterLink>
          )}

          <Link
            href={DOCUMENTATION_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <TooltipButton tooltip="Documentation">
              <Icon name="CircleQuestionMark" />
            </TooltipButton>
          </Link>

          {requiresAuthorization && <TopBarAuthentication />}

          {/* Mobile hamburger menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-white hover:bg-stone-800"
                aria-label="Open menu"
              >
                <Icon name="Menu" size="lg" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-fit bg-stone-900 border-stone-700 px-4"
            >
              <SheetHeader>
                <SheetTitle className="text-white">Actions</SheetTitle>
              </SheetHeader>
              <BlockStack gap="3" className="mt-6">
                <ImportPipeline />
                <NewPipelineButton variant="outline" />
                <Link
                  href={DOCUMENTATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost">Documentation</Button>
                </Link>
              </BlockStack>
            </SheetContent>
          </Sheet>
        </InlineStack>
      </InlineStack>
    </div>
  );
};

const AppMenu = () => {
  const { pathname } = useLocation();

  if (pathname.startsWith(APP_ROUTES.EDITOR_V2)) {
    return null;
  }

  if (pathname.startsWith(APP_ROUTES.RUNS_V2)) {
    return null;
  }

  return <DefaultAppMenu />;
};

export default AppMenu;
