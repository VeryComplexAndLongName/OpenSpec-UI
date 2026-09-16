import { describe, expect, it } from "vitest";
import { ALL_TABS } from "./host-embed.js";
import { ICONS } from "./icons.js";
import { PAGE_HEADS } from "./page-heads.js";

// the-shell-wears-the-site-frame 2.8
describe("PAGE_HEADS", () => {
  it("gives every tab a head, with an icon the font draws and words in each field", () => {
    for (const tab of ALL_TABS) {
      const head = PAGE_HEADS[tab.id];
      expect(head, tab.id).toBeDefined();
      expect(Object.keys(ICONS)).toContain(head?.icon);
      expect(head?.tagline.length, `${tab.id} tagline`).toBeGreaterThan(0);
      expect(head?.title.length, `${tab.id} title`).toBeGreaterThan(0);
      expect(head?.sentence.length, `${tab.id} sentence`).toBeGreaterThan(0);
    }
  });

  it("names no tab that does not exist", () => {
    const ids = new Set(ALL_TABS.map((tab) => tab.id));
    expect(Object.keys(PAGE_HEADS).filter((id) => !ids.has(id))).toEqual([]);
  });
});
