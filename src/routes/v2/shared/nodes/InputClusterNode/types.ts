export interface InputClusterMember {
  entityId: string;
  name: string;
}

export interface InputClusterNodeData extends Record<string, unknown> {
  clusterId: string;
  members: InputClusterMember[];
}
