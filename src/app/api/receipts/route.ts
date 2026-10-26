import { readLimitedBody } from "@/server/body-limit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { apiError, authorize, HttpError, sameOrigin } from "@/server/auth";
import type { FinancialState } from "@/domain";
const MAX_BYTES = 5 * 1024 * 1024;
function verifyFile(bytes: Buffer, type: string) {
  if (type === "application/pdf")
    return bytes.subarray(0, 5).toString() === "%PDF-";
  if (type === "image/png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return false;
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + 16384)
      throw new HttpError(413, "Receipt exceeds 5 MB");
    const businessId = z
      .uuid()
      .parse(new URL(request.url).searchParams.get("businessId"));
    const { db, user } = await authorize(request, businessId);
    let body: Uint8Array;
    try {
      body = await readLimitedBody(request, MAX_BYTES + 16384);
    } catch {
      throw new HttpError(413, "Receipt request exceeds 5 MB");
    }
    const form = await new Response(body as BodyInit, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const expenseId = z.string().min(1).max(100).parse(form.get("expenseId"));
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES)
      throw new HttpError(422, "Choose a receipt file up to 5 MB");
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!verifyFile(bytes, file.type))
      throw new HttpError(422, "Use a valid PNG, JPEG, or PDF receipt");
    const { data: workspace, error } = await db
      .from("workspace_states")
      .select("state")
      .eq("business_id", businessId)
      .single();
    if (
      error ||
      !(workspace.state as FinancialState).expenses.some(
        (e) => e.id === expenseId,
      )
    )
      throw new HttpError(404, "Expense not found");
    const receiptId = randomUUID();
    const extension =
      file.type === "application/pdf"
        ? "pdf"
        : file.type === "image/png"
          ? "png"
          : "jpg";
    const path = `${businessId}/${receiptId}.${extension}`;
    const uploaded = await db.storage
      .from("receipts")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploaded.error)
      throw new HttpError(503, "Receipt storage unavailable. Please retry.");
    const inserted = await db.from("receipts").insert({
      id: receiptId,
      business_id: businessId,
      expense_id: expenseId,
      storage_path: path,
    });
    if (inserted.error) {
      await db.storage.from("receipts").remove([path]);
      throw new HttpError(
        503,
        "Receipt record could not be saved. Please retry.",
      );
    }
    const audit = await db.from("audit_logs").insert({
      business_id: businessId,
      actor_id: user.id,
      action: "UPLOAD_RECEIPT",
      resource_id: receiptId,
    });
    if (audit.error)
      throw new HttpError(
        503,
        "Receipt saved, but audit recording failed. Refresh before retrying.",
      );
    return Response.json(
      { receiptId },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const businessId = z.uuid().parse(params.get("businessId"));
    const receiptId = z.uuid().parse(params.get("receiptId"));
    const { db } = await authorize(request, businessId);
    const { data, error } = await db
      .from("receipts")
      .select("storage_path")
      .eq("id", receiptId)
      .eq("business_id", businessId)
      .single();
    if (error || !data) throw new HttpError(404, "Receipt not found");
    const result = await db.storage
      .from("receipts")
      .createSignedUrl(data.storage_path, 60, { download: true });
    if (result.error) throw new HttpError(503, "Receipt download unavailable");
    return Response.json(
      { url: result.data.signedUrl },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
