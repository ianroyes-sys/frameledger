import { readJson } from "@/server/auth";
import { authorize, apiError, sameOrigin } from "@/server/auth";
import { reconcileBusiness } from "@/server/reconcile";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { businessId } = z
      .object({ businessId: z.uuid() })
      .parse(await readJson(request));
    await authorize(request, businessId);
    return Response.json(await reconcileBusiness(businessId));
  } catch (e) {
    return apiError(e);
  }
}
