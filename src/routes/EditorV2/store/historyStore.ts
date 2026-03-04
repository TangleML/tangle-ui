import { action, makeObservable, observable } from "mobx";

interface HistoryEntry {
  id: number;
  timestamp: Date;
  description: string;
  type: "action" | "undo" | "redo";
}

const MAX_ENTRIES = 100;

class HistoryStore {
  entries: HistoryEntry[] = [];
  enabled = true;
  private nextId = 0;

  constructor() {
    makeObservable(this, {
      entries: observable.shallow,
      enabled: observable,
      addEntry: action,
      clear: action,
      setEnabled: action,
    });
  }

  addEntry(description: string, type: HistoryEntry["type"] = "action") {
    if (!this.enabled) return;

    this.entries.push({
      id: this.nextId++,
      timestamp: new Date(),
      description,
      type,
    });

    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
  }

  clear() {
    this.entries = [];
    this.nextId = 0;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

export const historyStore = new HistoryStore();
