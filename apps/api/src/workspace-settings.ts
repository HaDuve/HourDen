import type { InvoiceOperator } from "@hourden/domain/invoice-pdf";
import { Hono } from "hono";
import type { Pool } from "pg";
import {
  getWorkspaceInvoiceSenderStatus,
  updateWorkspaceInvoiceSender,
  type UpdateInvoiceSenderInput,
} from "./db/workspaces.js";
import { getCurrentWorkspaceId } from "./workspace.js";

async function readJsonBody<T>(
  c: { req: { json: () => Promise<T> }; json: (data: unknown, status?: number) => Response },
): Promise<T | Response> {
  try {
    return await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
}

function validateInvoiceSenderInput(
  body: UpdateInvoiceSenderInput,
): string | null {
  if (body.name !== undefined && !body.name.trim()) {
    return "name cannot be empty";
  }
  if (body.email !== undefined && !body.email.trim()) {
    return "email cannot be empty";
  }
  return null;
}

export function createWorkspaceSettingsRouter(pool: Pool) {
  const router = new Hono();

  router.get("/invoice-sender", async (c) => {
    const status = await getWorkspaceInvoiceSenderStatus(
      pool,
      getCurrentWorkspaceId(),
    );
    return c.json(status);
  });

  router.patch("/invoice-sender", async (c) => {
    const body = await readJsonBody<UpdateInvoiceSenderInput>(c);
    if (body instanceof Response) {
      return body;
    }

    const validationError = validateInvoiceSenderInput(body);
    if (validationError) {
      return c.json({ error: validationError }, 400);
    }

    const invoiceSender = await updateWorkspaceInvoiceSender(
      pool,
      getCurrentWorkspaceId(),
      body,
    );

    if (!invoiceSender) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    return c.json({ invoiceSender, configured: true });
  });

  return router;
}

export type { InvoiceOperator };
