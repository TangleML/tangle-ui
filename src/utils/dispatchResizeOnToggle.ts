import { isTourActive } from "@/utils/tourActive";

export function dispatchResizeOnToggle(open: boolean): void {
  if (!isTourActive()) return;
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
  });
  if (!open) {
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 250);
  }
}
