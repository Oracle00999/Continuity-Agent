// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi } from "vitest";
import { PlanReview } from "../app/routes/handover";
import { planSchema } from "../shared/handover-plans";
const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@agent-native/core/client/hooks", () => ({
  useActionMutation: () => ({
    mutate: mocks.mutate,
    isPending: false,
    isError: false,
  }),
  useActionQuery: vi.fn(),
  actionErrorMessage: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const plan = planSchema.parse({
  id: "private-plan",
  workspaceId: "private-workspace",
  personId: "private-alex",
  personName: "Alex Morgan",
  departureDate: "2026-11-06T12:00:00Z",
  status: "draft",
  revision: 1,
  reviewNotes: "",
  approvedBy: null,
  approvedAt: null,
  createdAt: "2026-10-31T12:00:00Z",
  updatedAt: "2026-10-31T12:00:00Z",
  urlPath: "/handover?planId=private-plan",
  hasMore: false,
  tasks: [
    {
      id: "private-task",
      workspaceId: "private-workspace",
      runId: null,
      stepNumber: null,
      planId: "private-plan",
      findingId: "private-risk",
      documentId: "private-document",
      sourceName: "Restore runbook",
      gapResult: null,
      title: "Document the backup location",
      description: "Clarify the approved backup location and arrange a retest.",
      priority: "high",
      assignmentStatus: "suggested",
      assigneeId: null,
      assigneeName: null,
      dueDate: null,
      status: "todo",
      revision: 0,
      createdAt: "2026-10-31T12:00:00Z",
      updatedAt: "2026-10-31T12:00:00Z",
      urlPath: "/tasks?taskId=private-task",
      sourceUrlPath: "/documents?documentId=private-document",
      runUrlPath: null,
      findingUrlPath: "/risks?findingId=private-risk",
      planUrlPath: "/handover?planId=private-plan",
    },
  ],
});
describe("departure plan review UI", () => {
  it("handles unassigned dates safely and never approves on render", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <MemoryRouter>
          <PlanReview plan={plan} />
        </MemoryRouter>,
      ),
    );
    expect(host.textContent).toContain("Document the backup location");
    expect(host.textContent).not.toContain("private-");
    expect([...host.querySelectorAll("button")].at(-1)?.disabled).toBe(true);
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(host.querySelector('a[href*="private-risk"]')).toBeTruthy();
    await act(async () => root.unmount());
    host.remove();
  });
  it("does not offer removal of confirmed assignments when a plan is reopened", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const approved = {
      ...plan,
      tasks: plan.tasks.map((t) => ({
        ...t,
        assignmentStatus: "confirmed" as const,
        assigneeId: "private-maya",
        assigneeName: "Maya Chen",
        dueDate: "2026-11-05",
      })),
    };
    await act(async () =>
      root.render(
        <MemoryRouter>
          <PlanReview plan={approved} />
        </MemoryRouter>,
      ),
    );
    expect(host.querySelectorAll("button")).toHaveLength(1);
    expect(host.textContent).toContain("Maya Chen");
    await act(async () => root.unmount());
    host.remove();
  });
});
