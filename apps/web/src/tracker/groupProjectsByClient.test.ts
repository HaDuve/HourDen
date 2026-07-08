import { describe, expect, it } from "vitest";
import type { Client, Project } from "@hourden/domain";
import { groupProjectsByClient } from "./groupProjectsByClient.js";

const bandao: Client = {
  id: "c1",
  name: "Bandao",
  defaultRate: 60,
  legalName: null,
  addressLine1: null,
  addressLine2: null,
  invoicePrefix: null,
  invoiceNumberSeqBeforeYear: false,
};

const hannah: Client = {
  id: "c2",
  name: "Hannah",
  defaultRate: 80,
  legalName: null,
  addressLine1: null,
  addressLine2: null,
  invoicePrefix: null,
  invoiceNumberSeqBeforeYear: false,
};

const ondojo: Project = {
  id: "p1",
  clientId: bandao.id,
  name: "Ondojo",
  color: null,
};

const coaching: Project = {
  id: "p2",
  clientId: hannah.id,
  name: "Coaching",
  color: null,
};

describe("groupProjectsByClient", () => {
  it("groups projects under their client name, sorted by client then project", () => {
    const groups = groupProjectsByClient(
      [coaching, ondojo],
      [hannah, bandao],
    );

    expect(groups).toEqual([
      { clientId: bandao.id, clientName: "Bandao", projects: [ondojo] },
      { clientId: hannah.id, clientName: "Hannah", projects: [coaching] },
    ]);
  });

  it("omits clients that have no projects", () => {
    const groups = groupProjectsByClient([ondojo], [bandao, hannah]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.clientName).toBe("Bandao");
  });
});
