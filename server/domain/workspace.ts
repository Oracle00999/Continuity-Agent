import { randomUUID } from "node:crypto";

import {
  defineActionErrors,
  type ActionRunContext,
} from "@agent-native/core/action";
import { and, asc, eq } from "drizzle-orm";
import type { z } from "zod";

import type {
  workspaceInputSchema,
  WorkspaceContext,
} from "../../shared/workspace.js";
import { getDb } from "../db/index.js";
import { activityEvents, people, systems, workspaces } from "../db/schema.js";

export const workspaceErrors = defineActionErrors(
  "sign_in_required",
  "workspace_not_found",
  "person_not_found",
);

function scope(context?: ActionRunContext): {
  ownerEmail: string;
  orgId: string;
} {
  const ownerEmail = context?.userEmail;
  if (!ownerEmail)
    return workspaceErrors.fail(
      "Sign in to open your workspace.",
      "sign_in_required",
      { statusCode: 401 },
    );
  return { ownerEmail, orgId: context?.orgId ?? "" };
}

export async function getWorkspaceContext(
  input: z.infer<typeof workspaceInputSchema>,
  context?: ActionRunContext,
): Promise<WorkspaceContext> {
  const caller = scope(context);
  const db = getDb();
  const [workspace] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      createdAt: workspaces.createdAt,
    })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.ownerEmail, caller.ownerEmail),
        eq(workspaces.orgId, caller.orgId),
        input.workspaceId ? eq(workspaces.id, input.workspaceId) : undefined,
      ),
    )
    .orderBy(asc(workspaces.createdAt), asc(workspaces.id))
    .limit(1);
  if (!workspace) {
    if (input.workspaceId)
      workspaceErrors.fail(
        "Workspace not found or unavailable.",
        "workspace_not_found",
        { statusCode: 404 },
      );
    if (input.selectedPersonId)
      workspaceErrors.fail(
        "Selected person is not in this workspace.",
        "person_not_found",
        { statusCode: 404 },
      );
    return { workspace: null, people: [], systems: [], selectedPerson: null };
  }
  const [members, infrastructure] = await Promise.all([
    db
      .select({
        id: people.id,
        workspaceId: people.workspaceId,
        name: people.name,
        role: people.role,
        departureDate: people.departureDate,
      })
      .from(people)
      .where(
        and(
          eq(people.workspaceId, workspace.id),
          eq(people.ownerEmail, caller.ownerEmail),
          eq(people.orgId, caller.orgId),
        ),
      )
      .orderBy(asc(people.name))
      .limit(100),
    db
      .select({
        id: systems.id,
        workspaceId: systems.workspaceId,
        name: systems.name,
        description: systems.description,
        criticality: systems.criticality,
      })
      .from(systems)
      .where(
        and(
          eq(systems.workspaceId, workspace.id),
          eq(systems.ownerEmail, caller.ownerEmail),
          eq(systems.orgId, caller.orgId),
        ),
      )
      .orderBy(asc(systems.name))
      .limit(100),
  ]);
  const selectedPerson = input.selectedPersonId
    ? members.find((person) => person.id === input.selectedPersonId)
    : null;
  if (input.selectedPersonId && !selectedPerson)
    workspaceErrors.fail(
      "Selected person is not in this workspace.",
      "person_not_found",
      { statusCode: 404 },
    );
  return {
    workspace,
    people: members,
    systems: infrastructure,
    selectedPerson: selectedPerson ?? null,
  };
}

export async function initializeDemoWorkspace(context?: ActionRunContext) {
  const caller = scope(context);
  const db = getDb();
  const createdAt = new Date().toISOString();
  const departureDate = new Date(Date.now() + 7 * 86_400_000).toISOString();
  await db.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({
        id: randomUUID(),
        ...caller,
        name: "Northstar Digital",
        createdAt,
      })
      .onConflictDoNothing()
      .returning();
    if (!workspace) return;
    await tx.insert(people).values(
      (
        [
          ["alex", "Alex Morgan", "Senior DevOps Engineer"],
          ["maya", "Maya Chen", "Backend Engineer"],
          ["daniel", "Daniel Reed", "Engineering Lead"],
          ["priya", "Priya Shah", "Platform Engineer"],
          ["jordan", "Jordan Lee", "Frontend Engineer"],
        ] as const
      ).map(([key, name, role]) => ({
        id: `${workspace.id}:${key}`,
        ...caller,
        workspaceId: workspace.id,
        name,
        role,
        departureDate: key === "alex" ? departureDate : null,
      })),
    );
    await tx.insert(systems).values(
      [
        {
          key: "api",
          name: "Production API",
          description: "Customer-facing application services.",
          criticality: "critical" as const,
        },
        {
          key: "database",
          name: "PostgreSQL database",
          description: "Primary application data store.",
          criticality: "critical" as const,
        },
        {
          key: "vps",
          name: "VPS infrastructure",
          description: "Compute hosts and network configuration.",
          criticality: "high" as const,
        },
        {
          key: "deployment",
          name: "Deployment pipeline",
          description: "Release delivery and rollback workflow.",
          criticality: "high" as const,
        },
        {
          key: "monitoring",
          name: "Monitoring and alerting",
          description: "Service health signals and incident notifications.",
          criticality: "high" as const,
        },
        {
          key: "backups",
          name: "Backup storage",
          description: "Database recovery artifacts and retention.",
          criticality: "critical" as const,
        },
      ].map(({ key, ...system }) => ({
        ...system,
        ...caller,
        id: `${workspace.id}:${key}`,
        workspaceId: workspace.id,
      })),
    );
    await tx.insert(activityEvents).values({
      id: randomUUID(),
      ...caller,
      workspaceId: workspace.id,
      actor: caller.ownerEmail,
      eventType: "demo_workspace_initialized",
      summary:
        "Created the fictional Northstar Digital workspace with five people and six systems.",
      createdAt,
    });
  });
  return getWorkspaceContext({}, context);
}
