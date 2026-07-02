import type { CreateProjectInput, UpdateProjectInput } from "@hourden/domain";
import { Hono } from "hono";
import type { Pool } from "pg";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from "./db/projects.js";
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

export function createProjectsRouter(pool: Pool) {
  const router = new Hono();

  router.get("/", async (c) => {
    const clientId = c.req.query("clientId");
    const projects = await listProjects(
      pool,
      getCurrentWorkspaceId(),
      clientId || undefined,
    );
    return c.json({ projects });
  });

  router.post("/", async (c) => {
    const body = await readJsonBody<CreateProjectInput>(c);
    if (body instanceof Response) return body;

    if (!body.clientId?.trim()) {
      return c.json({ error: "clientId is required" }, 400);
    }
    if (!body.name?.trim()) {
      return c.json({ error: "name is required" }, 400);
    }

    const project = await createProject(pool, getCurrentWorkspaceId(), {
      clientId: body.clientId.trim(),
      name: body.name.trim(),
      color: body.color ?? null,
    });

    if (!project) {
      return c.json({ error: "Client not found" }, 404);
    }

    return c.json(project, 201);
  });

  router.patch("/:id", async (c) => {
    const body = await readJsonBody<UpdateProjectInput>(c);
    if (body instanceof Response) return body;

    if (body.name !== undefined && !body.name.trim()) {
      return c.json({ error: "name cannot be empty" }, 400);
    }

    const project = await updateProject(
      pool,
      getCurrentWorkspaceId(),
      c.req.param("id"),
      {
        ...body,
        name: body.name?.trim(),
      },
    );

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json(project);
  });

  router.delete("/:id", async (c) => {
    const deleted = await deleteProject(
      pool,
      getCurrentWorkspaceId(),
      c.req.param("id"),
    );

    if (!deleted) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.body(null, 204);
  });

  return router;
}
