import { Link as RouterLink } from "@tanstack/react-router";
import { Menu } from "lucide-react";
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
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { SETTINGS_PATH } from "@/routes/router";
import { DOCUMENTATION_URL, TOP_NAV_HEIGHT } from "@/utils/constants";

import TooltipButton from "../shared/Buttons/TooltipButton";
import NewPipelineButton from "../shared/NewPipelineButton";

const AppMenu = () => {
  const requiresAuthorization = isAuthorizationRequired();
  const { componentSpec } = useComponentSpec();
  const title = componentSpec?.name;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const documentationButton = (
    <Link href={DOCUMENTATION_URL} target="_blank" rel="noopener noreferrer">
      <TooltipButton tooltip="Documentation">
        <Icon name="CircleQuestionMark" />
      </TooltipButton>
    </Link>
  );

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

        <InlineStack gap="8" wrap="nowrap" className="shrink-0">
          {/* Desktop action buttons - hidden on mobile */}
          <InlineStack gap="2" className="hidden md:flex" wrap="nowrap">
            <ImportPipeline />
            <NewPipelineButton />
          </InlineStack>

          {/* Always visible settings */}
          <InlineStack gap="2" wrap="nowrap">
            <RouterLink to={`${SETTINGS_PATH}/backend` as string}>
              <TooltipButton tooltip="Settings">
                <Icon name="Settings" />
              </TooltipButton>
            </RouterLink>
            {documentationButton}
            {requiresAuthorization && <TopBarAuthentication />}
          </InlineStack>

          {/* Mobile hamburger menu - visible only on mobile */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-white hover:bg-stone-800"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
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
                <NewPipelineButton />
                {documentationButton}
              </BlockStack>
            </SheetContent>
          </Sheet>
        </InlineStack>
      </InlineStack>
    </div>
  );
};

export default AppMenu;
