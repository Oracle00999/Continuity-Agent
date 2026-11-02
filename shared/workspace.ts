import { z } from "zod";

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
});
export const personSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  role: z.string(),
  departureDate: z.string().nullable(),
});
export const systemSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string(),
  criticality: z.enum(["critical", "high", "normal"]),
});
export const workspaceContextSchema = z.object({
  workspace: workspaceSchema.nullable(),
  people: z.array(personSchema),
  systems: z.array(systemSchema),
  selectedPerson: personSchema.nullable(),
});
export const workspaceInputSchema = z.object({
  workspaceId: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("Workspace ID; defaults to the caller's first saved workspace."),
  selectedPersonId: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe(
      "Selected person ID from this workspace; omit to return no selection.",
    ),
});
export type WorkspaceContext = z.infer<typeof workspaceContextSchema>;
