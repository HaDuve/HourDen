import { expect, it } from "vitest";
import { describeWithAuthenticatedWebWorkspace } from "./test/describe-with-live-api.js";

describeWithAuthenticatedWebWorkspace("fetch proxy for web integration tests", () => {
  it("previews an invoice through proxied fetch with a blob response", async () => {
    const clientRes = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bandao",
        defaultRate: 60,
        legalName: "BANDAO Guidance GmbH",
        addressLine1: "Schloßbergstraße 1",
        addressLine2: "82319 Starnberg",
      }),
    });
    expect(clientRes.status).toBe(201);
    const client = (await clientRes.json()) as { id: string };

    const projectRes = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id, name: "Ondojo" }),
    });
    expect(projectRes.status).toBe(201);
    const project = (await projectRes.json()) as { id: string };

    const entryRes = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        description: "Billable work",
        startedAt: "2026-06-18T10:00:00.000Z",
        endedAt: "2026-06-18T11:00:00.000Z",
      }),
    });
    expect(entryRes.status).toBe(201);

    const previewRes = await fetch("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: client.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    expect(previewRes.status).toBe(200);
    expect(previewRes.headers.get("content-type")).toContain("application/pdf");
    const blob = await previewRes.blob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
