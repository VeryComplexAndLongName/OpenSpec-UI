import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Tabs, TabPanel, type TabDefinition } from "./Tabs.js";
import { computeVisibleTabs } from "../host-embed.js";

const tabs: TabDefinition[] = [
  { id: "run-a-command", label: "Run a Command" },
  { id: "processes", label: "Processes and Recovery" },
];

describe("Tabs", () => {
  it("renders a button per tab and marks the active one", () => {
    render(<Tabs tabs={tabs} activeTab="processes" onSelect={vi.fn()} />);
    expect(screen.getByTestId("page-tab-run-a-command")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("page-tab-processes")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("page-tab-processes")).toHaveClass("is-active");
  });

  it("calls onSelect with the clicked tab id", () => {
    const onSelect = vi.fn();
    render(<Tabs tabs={tabs} activeTab="run-a-command" onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("page-tab-processes"));
    expect(onSelect).toHaveBeenCalledWith("processes");
  });
});

describe("TabPanel", () => {
  it("hides the inactive panel but keeps it mounted", () => {
    render(
      <>
        <TabPanel id="a" activeTab="a">
          <p>Panel A</p>
        </TabPanel>
        <TabPanel id="b" activeTab="a">
          <p>Panel B</p>
        </TabPanel>
      </>,
    );
    expect(screen.getByTestId("page-tab-panel-a")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("page-tab-panel-b")).toHaveAttribute("hidden");
    expect(screen.getByText("Panel B")).toBeInTheDocument();
  });

  it("preserves child state across tab switches", () => {
    function Draft() {
      const [value, setValue] = useState("");
      return <input aria-label="draft" value={value} onChange={(e) => setValue(e.target.value)} />;
    }

    function Harness() {
      const [activeTab, setActiveTab] = useState("editor");
      return (
        <>
          <button type="button" onClick={() => setActiveTab("editor")}>editor</button>
          <button type="button" onClick={() => setActiveTab("other")}>other</button>
          <TabPanel id="editor" activeTab={activeTab}>
            <Draft />
          </TabPanel>
          <TabPanel id="other" activeTab={activeTab}>
            <p>Other tab</p>
          </TabPanel>
        </>
      );
    }

    render(<Harness />);
    fireEvent.change(screen.getByLabelText("draft"), { target: { value: "unsaved edits" } });
    fireEvent.click(screen.getByText("other"));
    fireEvent.click(screen.getByText("editor"));
    expect(screen.getByLabelText("draft")).toHaveValue("unsaved edits");
  });
});

describe("Tabs with computeVisibleTabs", () => {
  it("renders only the Run a Command tab under the VS Code local-server embed signal", () => {
    render(<Tabs tabs={computeVisibleTabs("vscode-local-server")} activeTab="run-a-command" onSelect={vi.fn()} />);
    expect(screen.getByTestId("page-tab-run-a-command")).toBeInTheDocument();
    expect(screen.queryByTestId("page-tab-processes")).not.toBeInTheDocument();
    expect(screen.queryByTestId("page-tab-diff-preview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("page-tab-overview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("page-tab-change-editor")).not.toBeInTheDocument();
  });

  it("renders all five tabs in a plain standalone browser tab", () => {
    render(<Tabs tabs={computeVisibleTabs("")} activeTab="run-a-command" onSelect={vi.fn()} />);
    for (const id of ["run-a-command", "processes", "diff-preview", "overview", "change-editor"]) {
      expect(screen.getByTestId(`page-tab-${id}`)).toBeInTheDocument();
    }
  });
});
