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

  it("does not mount a lazy panel's children before it has ever been active", () => {
    render(
      <>
        <TabPanel id="a" activeTab="a" lazy>
          <p>Panel A</p>
        </TabPanel>
        <TabPanel id="b" activeTab="a" lazy>
          <p>Panel B</p>
        </TabPanel>
      </>,
    );
    expect(screen.getByTestId("page-tab-panel-a")).not.toHaveAttribute("hidden");
    expect(screen.getByText("Panel A")).toBeInTheDocument();
    expect(screen.getByTestId("page-tab-panel-b")).toHaveAttribute("hidden");
    expect(screen.queryByText("Panel B")).not.toBeInTheDocument();
  });

  it("mounts a lazy panel's children once it becomes active, and keeps them mounted after switching away", () => {
    function Harness() {
      const [activeTab, setActiveTab] = useState("a");
      return (
        <>
          <button type="button" onClick={() => setActiveTab("a")}>a</button>
          <button type="button" onClick={() => setActiveTab("b")}>b</button>
          <TabPanel id="a" activeTab={activeTab} lazy>
            <p>Panel A</p>
          </TabPanel>
          <TabPanel id="b" activeTab={activeTab} lazy>
            <p>Panel B</p>
          </TabPanel>
        </>
      );
    }

    render(<Harness />);
    expect(screen.queryByText("Panel B")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("b"));
    expect(screen.getByText("Panel B")).toBeInTheDocument();

    fireEvent.click(screen.getByText("a"));
    expect(screen.getByTestId("page-tab-panel-b")).toHaveAttribute("hidden");
    expect(screen.getByText("Panel B")).toBeInTheDocument();
  });

  it("preserves child state across tab switches for a lazy panel, once opened", () => {
    function Draft() {
      const [value, setValue] = useState("");
      return <input aria-label="draft" value={value} onChange={(e) => setValue(e.target.value)} />;
    }

    function Harness() {
      const [activeTab, setActiveTab] = useState("run-a-command");
      return (
        <>
          <button type="button" onClick={() => setActiveTab("editor")}>editor</button>
          <button type="button" onClick={() => setActiveTab("run-a-command")}>run-a-command</button>
          <TabPanel id="run-a-command" activeTab={activeTab} lazy>
            <p>Run a Command</p>
          </TabPanel>
          <TabPanel id="editor" activeTab={activeTab} lazy>
            <Draft />
          </TabPanel>
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByText("editor"));
    fireEvent.change(screen.getByLabelText("draft"), { target: { value: "unsaved edits" } });
    fireEvent.click(screen.getByText("run-a-command"));
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

  it("renders all six tabs in a plain standalone browser tab", () => {
    render(<Tabs tabs={computeVisibleTabs("")} activeTab="run-a-command" onSelect={vi.fn()} />);
    for (const id of ["run-a-command", "processes", "diff-preview", "overview", "change-editor", "templates"]) {
      expect(screen.getByTestId(`page-tab-${id}`)).toBeInTheDocument();
    }
  });

  it("excludes the Templates tab from the VS Code local-server embed", () => {
    render(<Tabs tabs={computeVisibleTabs("vscode-local-server")} activeTab="run-a-command" onSelect={vi.fn()} />);
    expect(screen.queryByTestId("page-tab-templates")).not.toBeInTheDocument();
  });
});
