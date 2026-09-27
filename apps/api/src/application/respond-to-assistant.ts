import { createLocalAssistantReply } from '../domain/assistant.js';

export interface AssistantResponse {
  readonly reply: string;
  readonly mode: 'local';
  readonly timestamp: string;
}

export function respondToAssistant(message: string): AssistantResponse {
  return {
    reply: createLocalAssistantReply(message),
    mode: 'local',
    timestamp: new Date().toISOString(),
  };
}
