import "./load-env.js";

import { describe, expect, it, vi } from "vitest";
import { withAuthenticatedWorkspace } from "../../../api/src/test/integration-fixture.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("integration fixture teardown in jsdom", () => {
  it("teardown stops proxied fetch from querying the ended pool", async () => {
    const workspace = await withAuthenticatedWorkspace("web", databaseUrl);
    const querySpy = vi.spyOn(workspace.pool, "query");
    await workspace.teardown();
    querySpy.mockClear();

    try {
      await fetch("/api/clients");
    } catch {
      // Restored jsdom fetch may reject relative URLs — that is acceptable.
    }

    expect(querySpy).not.toHaveBeenCalled();
  });
});
