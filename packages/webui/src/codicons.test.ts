import { describe, expect, it } from "vitest";
import { CHANGE_ACTIONS } from "@openspec-ui/core/browser";
import { CODICON_PATHS } from "./codicons.generated.js";

// a-change-is-acted-on-from-its-card: a card draws each action with the icon
// its command has in VS Code's menus. A name missing here is added to
// scripts/extract-codicons.py's list, and the script run again.
describe("the codicons a card draws", () => {
  it("has the outline of every change action's icon", () => {
    expect(CHANGE_ACTIONS.filter((action) => CODICON_PATHS[action.icon] === undefined).map((action) => action.icon)).toEqual([]);
  });
});
