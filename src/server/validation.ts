import { z } from "zod";
const id = z.string().min(1).max(100),
  text = z.string().trim().min(1).max(500),
  money = z.number().int().nonnegative().max(10000000000),
  date = z.iso.date();
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("CREATE_CLIENT"),
    client: z.object({
      id,
      name: text,
      email: z.email(),
      company: text.optional(),
    }),
  }),
  z.object({
    type: z.literal("CREATE_PROJECT"),
    project: z.object({
      id,
      name: text,
      clientId: id,
      type: text,
      date,
      value: money.positive(),
      status: z.literal("active"),
    }),
  }),
  z.object({
    type: z.literal("CREATE_INVOICE"),
    invoice: z.object({
      id,
      projectId: id,
      number: text,
      description: text,
      amount: money.positive(),
      paid: z.literal(0),
      dueDate: date,
      status: z.literal("draft"),
    }),
  }),
  z.object({ type: z.literal("SEND_INVOICE"), id }),
  z.object({
    type: z.literal("ADD_EXPENSE"),
    expense: z.object({
      id,
      merchant: text,
      amount: money.positive(),
      category: text,
      date,
      projectId: id.optional(),
      commitmentId: id.optional(),
      receipt: z.string().max(1000).optional(),
    }),
  }),
  z.object({ type: z.literal("ASSIGN_EXPENSE"), id, projectId: id.optional() }),
  z.object({
    type: z.literal("UPDATE_EXPENSE"),
    id,
    category: text.optional(),
    receipt: z.string().max(1000).optional(),
  }),
  z.object({
    type: z.literal("ADD_COMMITMENT"),
    commitment: z.object({
      id,
      projectId: id,
      collaboratorId: id.optional(),
      description: text,
      amount: money.positive(),
      paid: z.literal(0),
      kind: z.enum(["contractor", "travel", "other"]),
    }),
  }),
  z.object({ type: z.literal("RELEASE_COMMITMENT"), id }),
  z.object({ type: z.literal("CLOSE_PROJECT"), id }),
  z.object({
    type: z.literal("SET_ALLOCATIONS"),
    taxBps: z.number().int().min(0).max(10000),
    gearBps: z.number().int().min(0).max(10000),
  }),
  z.object({ type: z.literal("SET_PROTECTED_RESERVES"), amount: money }),
  z.object({
    type: z.literal("ADD_COLLABORATOR"),
    collaborator: z.object({
      id,
      name: text,
      role: text,
      email: z.email(),
      taxStatus: z.enum([
        "Not requested",
        "Requested",
        "Received externally",
        "Verified externally",
      ]),
    }),
  }),
]);
export const workspaceCommand = z.object({
  businessId: z.uuid(),
  revision: z.number().int().nonnegative(),
  command: commandSchema,
});
