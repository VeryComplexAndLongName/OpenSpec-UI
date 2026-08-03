import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AGENT_REGISTRY } from "@openspec-ui/core/browser";
import { AgentPicker } from "./AgentPicker.js";

describe("AgentPicker", () => {
  it("renders one option per entry in the execution-core agent registry by default", () => {
    render(<AgentPicker value={AGENT_REGISTRY[0]!.id} onChange={() => {}} />);
    const options = screen.getByTestId("agent-picker").querySelectorAll("option");
    expect(options).toHaveLength(AGENT_REGISTRY.length);
    expect([...options].map((o) => o.textContent)).toEqual(AGENT_REGISTRY.map((a) => a.label));
  });

  it("calls onChange with the selected agent id", () => {
    const onChange = vi.fn();
    render(<AgentPicker value={AGENT_REGISTRY[0]!.id} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("agent-picker"), { target: { value: AGENT_REGISTRY[1]!.id } });
    expect(onChange).toHaveBeenCalledWith(AGENT_REGISTRY[1]!.id);
  });

  it("accepts a custom agent list override", () => {
    const custom = [{ id: "custom-agent", label: "Custom Agent" }];
    render(<AgentPicker agents={custom} value="custom-agent" onChange={() => {}} />);
    expect(screen.getByTestId("agent-picker").querySelectorAll("option")).toHaveLength(1);
    expect(screen.getByText("Custom Agent")).toBeInTheDocument();
  });
});
