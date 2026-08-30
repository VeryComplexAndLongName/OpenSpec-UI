import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useVirtualList, VIRTUALIZE_THRESHOLD } from "./use-virtual-list.js";

interface Item {
  id: string;
}

function makeItems(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({ id: `item-${i}` }));
}

function TestList({ items, itemHeight }: { items: Item[]; itemHeight?: number }) {
  const { containerRef, containerStyle, listStyle, rows } = useVirtualList(items, (item) => item.id, {
    itemHeight,
  });

  return (
    <div ref={containerRef} style={containerStyle} data-testid="scroll-container">
      <ul style={listStyle}>
        {rows.map(({ item, key, style }) => (
          <li key={key} data-testid={`row-${item.id}`} style={style}>
            {item.id}
          </li>
        ))}
      </ul>
    </div>
  );
}

describe("useVirtualList", () => {
  it("returns every item with no style when below the threshold", () => {
    const items = makeItems(5);
    render(<TestList items={items} />);

    expect(screen.getAllByTestId(/^row-/)).toHaveLength(5);
    expect(screen.getByTestId("row-item-0")).not.toHaveStyle({ position: "absolute" });
  });

  it("always sets a bounded maxHeight/overflowY on the container, even below the threshold", () => {
    const items = makeItems(3);
    render(<TestList items={items} />);

    const container = screen.getByTestId("scroll-container");
    expect(container).toHaveStyle({ overflowY: "auto" });
    expect(container.style.maxHeight.length).toBeGreaterThan(0);
  });

  describe("above the threshold", () => {
    beforeEach(() => {
      // happy-dom (like jsdom) reports 0 for these by default — the
      // standard way to give @tanstack/react-virtual a non-zero
      // viewport to compute a visible window against under a
      // non-layout-capable DOM (see design.md).
      Object.defineProperty(HTMLElement.prototype, "clientHeight", {
        configurable: true,
        value: 480,
      });
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
        configurable: true,
        value: 480,
      });
    });

    afterEach(() => {
      Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
      Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight");
    });

    it("mounts measurably fewer rows than the full item count, each absolutely positioned", () => {
      const items = makeItems(VIRTUALIZE_THRESHOLD + 200);
      render(<TestList items={items} itemHeight={40} />);

      const rows = screen.getAllByTestId(/^row-/);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThan(items.length);
      for (const row of rows) {
        expect(row).toHaveStyle({ position: "absolute" });
        expect(row.style.transform).toMatch(/^translateY\(/);
      }
    });

    it("renders correct item content for the mounted rows", () => {
      const items = makeItems(VIRTUALIZE_THRESHOLD + 50);
      render(<TestList items={items} itemHeight={40} />);

      // The first item is always within the initial visible window.
      expect(screen.getByTestId("row-item-0")).toHaveTextContent("item-0");
    });
  });
});
