// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import { MapCanvas } from "../app/routes/knowledge-map";
import { knowledgeMapSchema } from "../shared/knowledge-map";
import {
  pathForCommand,
  navigationStateForPath,
} from "../app/hooks/use-navigation-state";
const data = knowledgeMapSchema.parse({
  workspaceId: "private-workspace",
  nodes: [
    {
      id: "person:private-person",
      entityId: "private-person",
      kind: "person",
      name: "Alex Morgan",
      description: "DevOps Engineer",
      departureDate: null,
      urlPath: null,
    },
    {
      id: "process:private-process",
      entityId: "private-process",
      kind: "process",
      name: "Database restoration",
      description: null,
      departureDate: null,
      urlPath: null,
    },
    {
      id: "document:private-doc",
      entityId: "private-doc",
      kind: "document",
      name: "Recovery runbook",
      description: null,
      departureDate: null,
      urlPath: null,
    },
  ],
  edges: [
    {
      id: "edge-a",
      source: "person:private-person",
      target: "process:private-process",
      relationship: "owns",
      status: "inferred",
      claimId: "claim-a",
    },
    {
      id: "edge-b",
      source: "process:private-process",
      target: "document:private-doc",
      relationship: "documented_in",
      status: "confirmed",
      claimId: "claim-a",
    },
  ],
  selectedNode: null,
  selectedClaims: [],
  hasMore: false,
  claimCount: 1,
});
describe("Knowledge Map", () => {
  it("offers keyboard-focusable nodes with readable names and distinct review styles", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const onSelect = vi.fn();
    await act(async () =>
      root.render(<MapCanvas data={data} zoom={1} onSelect={onSelect} />),
    );
    const nodes = [...host.querySelectorAll("button")];
    expect(nodes).toHaveLength(3);
    expect(host.textContent).toContain("Alex Morgan");
    expect(host.textContent).not.toContain("private-person");
    expect(host.querySelectorAll("path[stroke-dasharray]")).toHaveLength(1);
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].focus();
      expect(document.activeElement).toBe(nodes[i]);
      await act(async () => nodes[i].click());
      expect(onSelect).toHaveBeenLastCalledWith(data.nodes[i].id);
    }
    await act(async () => root.unmount());
    host.remove();
  });
  it("maps agent navigation to the domain route", () => {
    expect(pathForCommand({ view: "knowledge-map" })).toBe("/knowledge-map");
    expect(navigationStateForPath("/knowledge-map").view).toBe("knowledge-map");
  });
});
