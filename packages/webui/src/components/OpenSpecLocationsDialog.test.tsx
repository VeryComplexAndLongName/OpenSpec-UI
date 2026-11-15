import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { OpenSpecLocationsDialog } from "./OpenSpecLocationsDialog.js";

it("shows workset folders and asks for a registered store catalog on selection", async () => {
  const request = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({
      stores: [{ id: "contracts", root: "/team/contracts" }],
      worksets: [{ name: "release", members: [{ name: "api", path: "/team/api" }] }],
      issues: [],
    }))
    .mockResolvedValueOnce(Response.json({ specs: [{ id: "checkout", requirementCount: 3 }] }));
  render(<OpenSpecLocationsDialog request={request} cwd="/team/web" onClose={() => undefined} />);

  expect(await screen.findByText("/team/api")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "contracts" }));
  expect(await screen.findByText("checkout (3 requirements)")).toBeVisible();
  expect(request).toHaveBeenLastCalledWith("/api/openspec-locations", expect.objectContaining({
    body: JSON.stringify({ cwd: "/team/web", store: "contracts" }),
  }));
});
