import type { InvoiceOperator } from "@hourden/domain/invoice-pdf";
import { Hono } from "hono";
import type { Pool } from "pg";
import {
  completeWorkspaceOnboarding,
  getWorkspaceInvoiceSenderStatus,
  getWorkspaceOnboardingStatus,
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
  const hasName = body.name !== undefined;
  const hasEmail = body.email !== undefined;
  if (hasName !== hasEmail) {
    return hasName
      ? "email is required when name is provided"
      : "name is required when email is provided";
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

    const status = await getWorkspaceInvoiceSenderStatus(
      pool,
      getCurrentWorkspaceId(),
    );
    return c.json(status);
  });

  router.get("/onboarding", async (c) => {
    const status = await getWorkspaceOnboardingStatus(
      pool,
      getCurrentWorkspaceId(),
    );

    if (!status) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    return c.json(status);
  });

  router.patch("/onboarding", async (c) => {
    const status = await completeWorkspaceOnboarding(
      pool,
      getCurrentWorkspaceId(),
    );

    if (!status) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    return c.json(status);
  });

  return router;
}

export type { InvoiceOperator };
