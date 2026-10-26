import { readJson } from "@/server/auth";
import {
  authorize,
  authenticate,
  apiError,
  HttpError,
  sameOrigin,
} from "@/server/auth";
import { workspaceCommand } from "@/server/validation";
import { initialState, reducer, type FinancialState } from "@/domain";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("businessId");
    const { db, user } = await authenticate(request);
    if (!id) {
      const { data, error } = await db
        .from("businesses")
        .select("id,name,whop_account_id")
        .eq("owner_id", user.id);
      if (error) throw error;
      return Response.json({ businesses: data });
    }
    await authorize(request, z.uuid().parse(id));
    const { data, error } = await db
      .from("workspace_states")
      .select("state,revision")
      .eq("business_id", id)
      .single();
    if (error) throw error;
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = workspaceCommand.parse(await readJson(request));
    const { db, user } = await authorize(request, body.businessId);
    if (
      body.command.type === "UPDATE_EXPENSE" ||
      body.command.type === "ADD_EXPENSE"
    ) {
      const receipt =
        body.command.type === "UPDATE_EXPENSE"
          ? body.command.receipt
          : body.command.expense.receipt;
      if (receipt) {
        const receiptId = z.uuid().parse(receipt);
        const expenseId =
          body.command.type === "UPDATE_EXPENSE"
            ? body.command.id
            : body.command.expense.id;
        const verified = await db
          .from("receipts")
          .select("id")
          .eq("id", receiptId)
          .eq("business_id", body.businessId)
          .eq("expense_id", expenseId)
          .single();
        if (verified.error || !verified.data)
          throw new HttpError(
            422,
            "Receipt must be uploaded to this expense in this workspace",
          );
      }
    }
    if (body.command.type === "SEND_INVOICE")
      throw new HttpError(
        409,
        "Use the confirmed Whop invoice endpoint to send a real invoice",
      );
    const { data, error } = await db
      .from("workspace_states")
      .select("state,revision")
      .eq("business_id", body.businessId)
      .single();
    if (error) throw error;
    if (data.revision !== body.revision)
      throw new HttpError(409, "Workspace changed. Refresh and retry.");
    let next;
    try {
      next = reducer(data.state as FinancialState, body.command);
    } catch (e) {
      throw new HttpError(
        422,
        e instanceof Error ? e.message : "Invalid command",
      );
    }
    const committed = await db.rpc("commit_workspace", {
      p_business_id: body.businessId,
      p_actor: user.id,
      p_expected_revision: body.revision,
      p_state: next,
      p_action: body.command.type,
    });
    if (committed.error)
      throw new HttpError(409, "Workspace changed. Refresh and retry.");
    return Response.json({ state: next, revision: committed.data });
  } catch (e) {
    return apiError(e);
  }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const { db, user } = await authenticate(request);
    const { name } = z
      .object({ name: z.string().trim().min(1).max(150) })
      .parse(await readJson(request));
    const state: FinancialState = {
      ...initialState,
      actualSettledBalance: 0,
      projects: [],
      clients: [],
      invoices: [],
      expenses: [],
      commitments: [],
      collaborators: [],
      payments: [],
      processedEvents: [],
    };
    const { data, error } = await db.rpc("create_workspace", {
      p_actor: user.id,
      p_name: name,
      p_state: state,
    });
    if (error) throw error;
    return Response.json(
      { businessId: data, state, revision: 0 },
      { status: 201 },
    );
  } catch (e) {
    return apiError(e);
  }
}
