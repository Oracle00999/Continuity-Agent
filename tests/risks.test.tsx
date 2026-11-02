// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi } from "vitest";
import { RiskDetail } from "../app/routes/risks";
import { riskSchema } from "../shared/risks";
import { riskMachine } from "../server/domain/risk-lifecycle";
import {
  pathForCommand,
  navigationStateForPath,
} from "../app/hooks/use-navigation-state";
vi.mock("@agent-native/core/client/hooks", () => ({
  useActionMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  }),
  getBrowserTabId: () => "qa-tab",
  useActionQuery: vi.fn(),
  actionErrorMessage: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const finding = riskSchema.parse({
  id: "private-finding",
  workspaceId: "private-workspace",
  key: "backup-location",
  type: "documentation_gap",
  title: "Backup location missing",
  description:
    "The reviewed runbook does not specify the backup location needed for restoration.",
  severity: "high",
  severityReason: "Missing retrieval details can block recovery.",
  confidence: 0.8,
  uncertainty: "The location may be documented in another approved source.",
  recommendedAction:
    "Document the approved location and repeat the human test.",
  status: "proposed",
  personId: null,
  personName: null,
  systemId: null,
  systemName: null,
  processId: null,
  processName: null,
  runId: null,
  revision: 0,
  createdAt: "2026-10-31T10:00:00Z",
  updatedAt: "2026-10-31T10:00:00Z",
  urlPath: "/risks?findingId=private-finding",
  reviewNotes: "",
  reviewedBy: null,
  evidence: [
    {
      evidenceId: "private-passage",
      documentId: "private-document",
      sourceName: "Restore runbook",
      quote: "Retrieve the completed backup from Backup storage.",
      urlPath:
        "/documents?documentId=private-document&evidenceId=private-passage",
    },
  ],
  verificationSnapshot: null,
});
describe("Risk Register", () => {
  it("shows supporting source and uncertainty without rendering reference IDs, and requires review notes", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <MemoryRouter>
          <RiskDetail risk={finding} />
        </MemoryRouter>,
      ),
    );
    expect(host.textContent).toContain(finding.uncertainty);
    expect(host.textContent).toContain(finding.evidence[0].quote);
    expect(host.textContent).not.toContain("private-");
    expect(host.querySelector("a")?.getAttribute("href")).toContain(
      "private-document",
    );
    expect(
      [...host.querySelectorAll("button")].at(-1)?.hasAttribute("disabled"),
    ).toBe(true);
    await act(async () => root.unmount());
    host.remove();
  });
  it("preserves the review lifecycle and allows explicit reopening", () => {
    const states = ["proposed", "accepted", "rejected", "resolved"] as const;
    expect(riskMachine.states).toEqual(states);
    expect(riskMachine.initial).toBe("proposed");
    for (const event of states) {
      expect(riskMachine.fromStates(event)).toEqual(states);
      expect(riskMachine.transition("proposed", event)).toBe(event);
      expect(riskMachine.transition("resolved", event)).toBe(event);
    }
  });
  it("supports the agent's route navigation", () => {
    expect(pathForCommand({ view: "risks" })).toBe("/risks");
    expect(navigationStateForPath("/risks").view).toBe("risks");
  });
});
