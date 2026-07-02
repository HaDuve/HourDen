import type { CreateClientInput, UpdateClientInput } from "@hourden/domain";
import { Hono } from "hono";
import type { Pool } from "pg";
import { createClient, deleteClient, listClients, updateClient } from "./db/clients.js";
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

export function createClientsRouter(pool: Pool) {
  const router = new Hono();

  router.get("/", async (c) => {
    const clients = await listClients(pool, getCurrentWorkspaceId());
    return c.json({ clients });
  });

  router.post("/", async (c) => {
    const body = await readJsonBody<CreateClientInput>(c);
    if (body instanceof Response) return body;

    if (!body.name?.trim()) {
      return c.json({ error: "name is required" }, 400);
    }
    if (typeof body.defaultRate !== "number" || body.defaultRate < 0) {
      return c.json({ error: "defaultRate must be a non-negative number" }, 400);
    }

    const client = await createClient(pool, getCurrentWorkspaceId(), {
      name: body.name.trim(),
      defaultRate: body.defaultRate,
      legalName: body.legalName ?? null,
      addressLine1: body.addressLine1 ?? null,
      addressLine2: body.addressLine2 ?? null,
    });

    return c.json(client, 201);
  });

  router.patch("/:id", async (c) => {
    const body = await readJsonBody<UpdateClientInput>(c);
    if (body instanceof Response) return body;

    if (body.name !== undefined && !body.name.trim()) {
      return c.json({ error: "name cannot be empty" }, 400);
    }
    if (
      body.defaultRate !== undefined &&
      (typeof body.defaultRate !== "number" || body.defaultRate < 0)
    ) {
      return c.json({ error: "defaultRate must be a non-negative number" }, 400);
    }

    const client = await updateClient(
      pool,
      getCurrentWorkspaceId(),
      c.req.param("id"),
      {
        ...body,
        name: body.name?.trim(),
      },
    );

    if (!client) {
      return c.json({ error: "Client not found" }, 404);
    }

    return c.json(client);
  });

  router.delete("/:id", async (c) => {
    const result = await deleteClient(
      pool,
      getCurrentWorkspaceId(),
      c.req.param("id"),
    );

    if (result === "not_found") {
      return c.json({ error: "Client not found" }, 404);
    }
    if (result === "has_projects") {
      return c.json(
        { error: "Cannot delete Client with existing Projects" },
        409,
      );
    }

    return c.body(null, 204);
  });

  return router;
}
