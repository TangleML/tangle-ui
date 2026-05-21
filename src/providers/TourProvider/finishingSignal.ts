// Reactour renders the Popover (and our FinishButton inside it) as a SIBLING
// of the provider's `children`, so a React Context placed inside the
// orchestrator isn't visible to FinishButton. We use module-local closure
// state with explicit setter/getter functions so call sites in components
// and hooks invoke utility functions instead of writing to outer-scope
// variables (which react-compiler flags).
let flag = false;

export const finishingSignal = {
  mark(): void {
    flag = true;
  },
  consume(): boolean {
    const previous = flag;
    flag = false;
    return previous;
  },
  reset(): void {
    flag = false;
  },
};
