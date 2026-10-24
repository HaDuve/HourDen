import { describe, expect, it } from "vitest";
import {
  cardClass,
  ledgerCellClass,
  listPanelClass,
  numericMetaValueClass,
  numericValueClass,
  panelClass,
} from "./ui-classes.js";

describe("ui-classes Warm Den surfaces", () => {
  it("list panels are hairline rows without a bordered box", () => {
    expect(listPanelClass).toMatch(/divide-y/);
    expect(listPanelClass).toMatch(/divide-divider/);
    expect(listPanelClass).not.toMatch(/\bborder\b/);
    expect(listPanelClass).not.toMatch(/bg-surface/);
  });

  it("KPI / ledger cells drop borders (no card box)", () => {
    expect(ledgerCellClass).not.toMatch(/\bborder\b/);
  });

  it("true containers keep a bordered surface (timer bar, overlays, login)", () => {
    expect(cardClass).toMatch(/\bborder\b/);
    expect(panelClass).toMatch(/\bborder\b/);
    expect(panelClass).toMatch(/border-divider/);
    expect(panelClass).toMatch(/bg-surface/);
  });

  it("numeric helpers use the self-hosted numeric face with tabular nums", () => {
    expect(numericValueClass).toMatch(/font-numeric/);
    expect(numericValueClass).toMatch(/tabular-nums/);
    expect(numericMetaValueClass).toMatch(/font-numeric/);
    expect(numericMetaValueClass).toMatch(/tabular-nums/);
    expect(numericValueClass).not.toMatch(/font-mono/);
  });
});
