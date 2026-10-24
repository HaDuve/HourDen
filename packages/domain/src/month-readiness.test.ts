import { describe, expect, it } from "vitest";
import { summarizeMonthReadiness } from "./month-readiness.js";

describe("summarizeMonthReadiness", () => {
  const timeZone = "Europe/Berlin";
  const monthKey = "2026-10";
  const from = "2026-10-01";
  const to = "2026-10-31";

  const bandao = {
    id: "client-bandao",
    name: "Bandao",
    hasRecipient: true,
  };
  const hannah = {
    id: "client-hannah",
    name: "Hannah",
    hasRecipient: false,
  };

  it("ranks Clients with text readiness counts, unbilled amount, and invoice status", () => {
    const summary = summarizeMonthReadiness(
      {
        entries: [
          {
            id: "e1",
            clientId: bandao.id,
            startedAt: "2026-10-05T10:00:00.000Z",
            endedAt: "2026-10-05T11:00:00.000Z",
            amount: 85,
            billableComplete: true,
            invoiced: false,
            description: "Dev",
          },
          {
            id: "e2",
            clientId: bandao.id,
            startedAt: "2026-10-06T10:00:00.000Z",
            endedAt: "2026-10-06T11:00:00.000Z",
            amount: null,
            billableComplete: false,
            invoiced: false,
            description: null,
          },
          {
            id: "e3",
            clientId: hannah.id,
            startedAt: "2026-10-07T10:00:00.000Z",
            endedAt: "2026-10-07T12:00:00.000Z",
            amount: 200,
            billableComplete: true,
            invoiced: false,
            description: "Coaching",
          },
        ],
        clients: [bandao, hannah],
        invoices: [],
        invoiceSenderConfigured: true,
      },
      { monthKey, timeZone, from, to },
    );

    expect(summary.from).toBe(from);
    expect(summary.to).toBe(to);
    expect(summary.invoiceSenderConfigured).toBe(true);
    expect(summary.monthClosed).toBe(false);

    // Incomplete / blockers first (Bandao incomplete, Hannah missing recipient)
    expect(summary.clients.map((c) => c.clientId)).toEqual([
      bandao.id,
      hannah.id,
    ]);

    const bandaoRow = summary.clients[0]!;
    expect(bandaoRow).toMatchObject({
      clientName: "Bandao",
      billableCompleteCount: 1,
      stoppedEntryCount: 2,
      unbilledAmount: 85,
      invoiceStatus: "none",
      missingRecipient: false,
    });
    expect(bandaoRow.incompleteEntries).toEqual([
      {
        id: "e2",
        description: null,
        startedAt: "2026-10-06T10:00:00.000Z",
      },
    ]);

    const hannahRow = summary.clients[1]!;
    expect(hannahRow).toMatchObject({
      clientName: "Hannah",
      billableCompleteCount: 1,
      stoppedEntryCount: 1,
      unbilledAmount: 200,
      invoiceStatus: "none",
      missingRecipient: true,
      incompleteEntries: [],
    });
  });

  it("sorts ready-to-invoice Clients before already-invoiced ones, blockers first", () => {
    const ready = {
      id: "client-ready",
      name: "Ready Co",
      hasRecipient: true,
    };
    const done = {
      id: "client-done",
      name: "Done Co",
      hasRecipient: true,
    };
    const blocked = {
      id: "client-blocked",
      name: "Blocked Co",
      hasRecipient: false,
    };

    const summary = summarizeMonthReadiness(
      {
        entries: [
          {
            id: "a",
            clientId: ready.id,
            startedAt: "2026-10-01T10:00:00.000Z",
            endedAt: "2026-10-01T11:00:00.000Z",
            amount: 50,
            billableComplete: true,
            invoiced: false,
            description: "A",
          },
          {
            id: "b",
            clientId: done.id,
            startedAt: "2026-10-02T10:00:00.000Z",
            endedAt: "2026-10-02T11:00:00.000Z",
            amount: 60,
            billableComplete: true,
            invoiced: true,
            description: "B",
          },
          {
            id: "c",
            clientId: blocked.id,
            startedAt: "2026-10-03T10:00:00.000Z",
            endedAt: "2026-10-03T11:00:00.000Z",
            amount: 70,
            billableComplete: true,
            invoiced: false,
            description: "C",
          },
        ],
        clients: [ready, done, blocked],
        invoices: [{ clientId: done.id, status: "sent" }],
        invoiceSenderConfigured: true,
      },
      { monthKey, timeZone, from, to },
    );

    expect(summary.clients.map((c) => c.clientName)).toEqual([
      "Blocked Co",
      "Ready Co",
      "Done Co",
    ]);
    expect(summary.clients[2]!.invoiceStatus).toBe("sent");
    expect(summary.clients[2]!.unbilledAmount).toBe(0);
  });

  it("marks the month closed when every Client with Billable Complete time has an issued or Sent Invoice", () => {
    const summary = summarizeMonthReadiness(
      {
        entries: [
          {
            id: "e1",
            clientId: bandao.id,
            startedAt: "2026-10-05T10:00:00.000Z",
            endedAt: "2026-10-05T11:00:00.000Z",
            amount: 85,
            billableComplete: true,
            invoiced: true,
            description: "Dev",
          },
          {
            id: "e2",
            clientId: hannah.id,
            startedAt: "2026-10-06T10:00:00.000Z",
            endedAt: "2026-10-06T11:00:00.000Z",
            amount: null,
            billableComplete: false,
            invoiced: false,
            description: null,
          },
        ],
        clients: [bandao, hannah],
        invoices: [{ clientId: bandao.id, status: "issued" }],
        invoiceSenderConfigured: true,
      },
      { monthKey, timeZone, from, to },
    );

    expect(summary.monthClosed).toBe(true);
    expect(summary.clients).toHaveLength(2);
  });

  it("excludes entries outside the Billing Period and Running Timers from stopped counts", () => {
    const summary = summarizeMonthReadiness(
      {
        entries: [
          {
            id: "in",
            clientId: bandao.id,
            startedAt: "2026-10-05T10:00:00.000Z",
            endedAt: "2026-10-05T11:00:00.000Z",
            amount: 85,
            billableComplete: true,
            invoiced: false,
            description: "In",
          },
          {
            id: "out",
            clientId: bandao.id,
            startedAt: "2026-09-15T10:00:00.000Z",
            endedAt: "2026-09-15T11:00:00.000Z",
            amount: 85,
            billableComplete: true,
            invoiced: false,
            description: "Out",
          },
          {
            id: "running",
            clientId: bandao.id,
            startedAt: "2026-10-20T10:00:00.000Z",
            endedAt: null,
            amount: null,
            billableComplete: false,
            invoiced: false,
            description: "Running",
          },
        ],
        clients: [bandao],
        invoices: [],
        invoiceSenderConfigured: true,
      },
      { monthKey, timeZone, from, to },
    );

    expect(summary.clients).toHaveLength(1);
    expect(summary.clients[0]).toMatchObject({
      billableCompleteCount: 1,
      stoppedEntryCount: 1,
      incompleteEntries: [],
    });
  });

  it("ignores entries without a Client and surfaces Invoice Sender configuration", () => {
    const summary = summarizeMonthReadiness(
      {
        entries: [
          {
            id: "orphan",
            clientId: null,
            startedAt: "2026-10-05T10:00:00.000Z",
            endedAt: "2026-10-05T11:00:00.000Z",
            amount: null,
            billableComplete: true,
            invoiced: false,
            description: "Orphan",
          },
        ],
        clients: [bandao],
        invoices: [],
        invoiceSenderConfigured: false,
      },
      { monthKey, timeZone, from, to },
    );

    expect(summary.clients).toEqual([]);
    expect(summary.invoiceSenderConfigured).toBe(false);
    expect(summary.monthClosed).toBe(true);
  });
});
