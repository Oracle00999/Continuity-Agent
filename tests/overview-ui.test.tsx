// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi } from "vitest";
import { OverviewDashboard } from "../app/routes/overview";
import { overviewSchema } from "../shared/overview";
import {
  pathForCommand,
  navigationStateForPath,
} from "../app/hooks/use-navigation-state";
vi.mock("@agent-native/core/client/i18n", async (original) => {
  const actual =
    await original<typeof import("@agent-native/core/client/i18n")>();
  const { continuity } = await import("../app/i18n/continuity");
  return {
    ...actual,
    useT:
      () =>
      (key: string, vars: Record<string, unknown> = {}) => {
        const text =
          continuity[
            key.replace("continuity.", "") as keyof typeof continuity
          ] ?? key;
        return text.replace(/\{\{(\w+)\}\}/g, (_m, name) =>
          String(vars[name] ?? ""),
        );
      },
  };
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const data = overviewSchema.parse({
  workspace: {
    id: "private-workspace",
    name: "Northstar Digital",
    createdAt: "2026-10-30T12:00:00Z",
  },
  asOf: "2026-10-31T12:00:00Z",
  calendarDay: "2026-10-31",
  departures: [
    {
      id: "private-person",
      workspaceId: "private-workspace",
      name: "Alex Morgan",
      role: "DevOps Engineer",
      departureDate: "2026-11-06T12:00:00Z",
    },
  ],
  metrics: {
    criticalSystems: 3,
    openRisks: 0,
    highPriorityRisks: 0,
    proposedRisks: 0,
    pendingAssignments: 0,
    overdueAssignments: 0,
    suggestedTasks: 2,
    ownershipCandidates: 0,
    runbooksWithResults: 0,
    latestPasses: 0,
    latestFailures: 0,
    latestGapped: 0,
    latestInProgress: 1,
  },
  topRisks: [],
  upcomingTasks: [],
  ownershipCandidates: [],
  latestTests: [
    {
      id: "private-run",
      documentId: "private-document",
      sourceName: "Restore runbook",
      testerName: "Maya Chen",
      status: "open",
      createdAt: "2026-10-31T10:00:00Z",
      urlPath: "/verification?runId=private-run",
    },
  ],
  activity: [
    {
      id: "private-event",
      kind: "risk_reviewed",
      detail: "Backup location missing",
      createdAt: "2026-10-31T10:00:00Z",
      urlPath: "/risks?workspaceId=private-workspace",
    },
  ],
});
describe("Overview presentation", () => {
  it("shows suggestions separately, readable activity and source links without visible IDs", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const refresh = vi.fn();
    await act(async () =>
      root.render(
        <MemoryRouter>
          <OverviewDashboard data={data} onRefresh={refresh} />
        </MemoryRouter>,
      ),
    );
    expect(host.textContent).toContain(
      "2 proposed tasks still need plan review",
    );
    expect(host.textContent).toContain("In progress");
    expect(host.textContent).toContain("Backup location missing");
    expect(host.textContent).not.toContain("private-");
    expect(host.textContent).not.toContain("2026-10-31T");
    expect(host.querySelector('a[href*="private-run"]')).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
    const button = host.querySelector('button[aria-label="Refresh overview"]')!;
    await act(async () => (button as HTMLButtonElement).click());
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    host.remove();
  });
  it("supports agent navigation to Overview", () => {
    expect(pathForCommand({ view: "overview" })).toBe("/overview");
    expect(navigationStateForPath("/overview").view).toBe("overview");
  });
});
