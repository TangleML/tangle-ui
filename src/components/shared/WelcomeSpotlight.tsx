import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import { getStorage } from "@/utils/typedStorage";

interface V2WelcomeStorage {
  "seen-editor-v2-welcome": boolean;
  "seen-run-v2-welcome": boolean;
}

const storage = getStorage<keyof V2WelcomeStorage, V2WelcomeStorage>();
const EDITOR_STORAGE_KEY = "seen-editor-v2-welcome";
const RUN_STORAGE_KEY = "seen-run-v2-welcome";
const SPOTLIGHT_PADDING = 16;
const CARD_WIDTH = 320;
const SPOTLIGHT_COLOR = "#5B35F5";
const SPOTLIGHT_HALO_COLOR = "rgba(91, 53, 245, 0.35)";

interface SpotlightRect {
  centerX: number;
  centerY: number;
  radius: number;
}

export function hasSeenEditorV2Welcome(): boolean {
  return storage.getItem(EDITOR_STORAGE_KEY) === true;
}

export function markEditorV2WelcomeSeen() {
  storage.setItem(EDITOR_STORAGE_KEY, true);
}

export function hasSeenRunV2Welcome(): boolean {
  return storage.getItem(RUN_STORAGE_KEY) === true;
}

export function markRunV2WelcomeSeen() {
  storage.setItem(RUN_STORAGE_KEY, true);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getSpotlightRect(target: HTMLElement): SpotlightRect {
  const rect = target.getBoundingClientRect();
  return {
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
    radius: Math.max(rect.width, rect.height) / 2 + SPOTLIGHT_PADDING,
  };
}

interface ClickBlockersProps {
  spotlight: SpotlightRect;
  onDismiss: () => void;
  dismissLabel: string;
}

function ClickBlockers({
  spotlight,
  onDismiss,
  dismissLabel,
}: ClickBlockersProps) {
  const { centerX, centerY, radius } = spotlight;
  const top = Math.max(centerY - radius, 0);
  const bottom = Math.min(centerY + radius, window.innerHeight);
  const left = Math.max(centerX - radius, 0);
  const right = Math.min(centerX + radius, window.innerWidth);

  return (
    <>
      <button
        type="button"
        aria-label={dismissLabel}
        className="fixed left-0 right-0 top-0 z-[1000] cursor-default bg-transparent"
        style={{ height: top }}
        onClick={onDismiss}
      />
      <button
        type="button"
        aria-label={dismissLabel}
        className="fixed bottom-0 left-0 right-0 z-[1000] cursor-default bg-transparent"
        style={{ top: bottom }}
        onClick={onDismiss}
      />
      <button
        type="button"
        aria-label={dismissLabel}
        className="fixed z-[1000] cursor-default bg-transparent"
        style={{ top, left: 0, width: left, height: bottom - top }}
        onClick={onDismiss}
      />
      <button
        type="button"
        aria-label={dismissLabel}
        className="fixed z-[1000] cursor-default bg-transparent"
        style={{ top, left: right, right: 0, height: bottom - top }}
        onClick={onDismiss}
      />
    </>
  );
}

interface WelcomeSpotlightProps {
  targetRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  title: string;
  description: string;
  titleId: string;
  dismissLabel: string;
}

export function WelcomeSpotlight({
  targetRef,
  onDismiss,
  title,
  description,
  titleId,
  dismissLabel,
}: WelcomeSpotlightProps) {
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const gotItRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const update = () => {
      if (!targetRef.current) return;
      setSpotlight(getSpotlightRect(targetRef.current));
    };

    update();
    const animationFrame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [targetRef]);

  useEffect(() => {
    gotItRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        gotItRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  if (!spotlight) return null;

  const cardTop = clamp(
    spotlight.centerY + spotlight.radius + 16,
    16,
    window.innerHeight - 180,
  );
  const cardLeft = clamp(
    spotlight.centerX - CARD_WIDTH / 2,
    16,
    window.innerWidth - CARD_WIDTH - 16,
  );

  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[999] bg-black/75 pointer-events-none"
        style={{
          WebkitMaskImage: `radial-gradient(circle ${spotlight.radius}px at ${spotlight.centerX}px ${spotlight.centerY}px, transparent 0, transparent ${spotlight.radius}px, black ${spotlight.radius + 1}px)`,
          maskImage: `radial-gradient(circle ${spotlight.radius}px at ${spotlight.centerX}px ${spotlight.centerY}px, transparent 0, transparent ${spotlight.radius}px, black ${spotlight.radius + 1}px)`,
        }}
      />
      <div
        aria-hidden="true"
        className="fixed z-[1001] rounded-full border-2 pointer-events-none"
        style={{
          left: spotlight.centerX - spotlight.radius,
          top: spotlight.centerY - spotlight.radius,
          width: spotlight.radius * 2,
          height: spotlight.radius * 2,
          borderColor: SPOTLIGHT_COLOR,
          boxShadow: `0 0 0 4px ${SPOTLIGHT_HALO_COLOR}`,
        }}
      />
      <ClickBlockers
        spotlight={spotlight}
        onDismiss={onDismiss}
        dismissLabel={dismissLabel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed z-[1002] rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg"
        style={{ top: cardTop, left: cardLeft, width: CARD_WIDTH }}
      >
        <BlockStack gap="3">
          <BlockStack gap="1">
            <Text id={titleId} weight="semibold">
              {title}
            </Text>
            <Paragraph size="sm" tone="subdued">
              {description}
            </Paragraph>
          </BlockStack>
          <Button ref={gotItRef} size="sm" onClick={onDismiss}>
            Got it
          </Button>
        </BlockStack>
      </div>
    </>,
    document.body,
  );
}
