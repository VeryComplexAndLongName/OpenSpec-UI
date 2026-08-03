// 5.1 Выбор агента — список из `execution-core`'s зарегистрированных
// AgentRunner-адаптеров (`AGENT_REGISTRY`), не собственный захардкоженный
// список.

import { AGENT_REGISTRY, type AgentDescriptor } from "@openspec-ui/core/browser";

export interface AgentPickerProps {
  agents?: readonly AgentDescriptor[];
  value: string;
  onChange: (agentId: string) => void;
}

export function AgentPicker({ agents = AGENT_REGISTRY, value, onChange }: AgentPickerProps) {
  return (
    <select
      aria-label="Select agent"
      data-testid="agent-picker"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {agents.map((agent) => (
        <option key={agent.id} value={agent.id}>
          {agent.label}
        </option>
      ))}
    </select>
  );
}
