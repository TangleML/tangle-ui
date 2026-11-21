import type { LocalAgentHostHandle } from "../localAgentHost.ts";
import type { ShellClient } from "../shellClient.ts";
import type { Project } from "../tangleRestClient.ts";

/** A project the user has opened: its resolved Shell plus the running host. */
export interface ActiveProject {
  project: Project;
  shellUrl: string;
  shell: ShellClient;
  host: LocalAgentHostHandle;
  userEmail?: string;
}
