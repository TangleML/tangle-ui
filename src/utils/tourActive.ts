let tourActive = false;

export function setTourActive(active: boolean): void {
  tourActive = active;
}

export function isTourActive(): boolean {
  return tourActive;
}
