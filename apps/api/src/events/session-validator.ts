import type { Pool } from "pg";
import { isValidSessionId } from "../auth/session-id.js";
import { isSessionExpired } from "../auth/session.js";
import { findSessionById, hasMembership } from "../db/auth.js";

export function createSessionValidator(pool: Pool) {
  return async (
    sessionId: string | undefined,
    workspaceId: string,
  ): Promise<boolean> => {
    if (!sessionId || !isValidSessionId(sessionId)) {
      return false;
    }

    const session = await findSessionById(pool, sessionId);
    if (!session || isSessionExpired(session.expires_at)) {
      return false;
    }

    if (session.active_workspace_id !== workspaceId) {
      return false;
    }

    return hasMembership(pool, session.user_id, workspaceId);
  };
}
