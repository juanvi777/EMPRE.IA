export type AgentName =
  | 'general'
  | 'research'
  | 'sales'
  | 'customers'
  | 'appointments'
  | 'documents'
  | 'automation'
  | 'system'
  | 'connector'
  | 'security';

export interface AgentRequest {
  readonly message: string;
  readonly tenantId: string;
  readonly userId: string;
}

export interface AgentDescriptor {
  readonly name: AgentName;
  readonly title: string;
  readonly description: string;
  readonly triggers: readonly string[];
  readonly requiresConnector: boolean;
}
