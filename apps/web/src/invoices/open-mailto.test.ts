import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMailtoHref, openMailto } from "./open-mailto.js";
import { deliverPrepareEmail } from "./prepare-email-delivery.js";

describe("buildMailtoHref", () => {
  it("matches a real Prepare Email draft", () => {
    const href = buildMailtoHref(
      "hannah@makeklar.de",
      "Rechnung Juli 2026",
      "Hallo Hannah,\n\nanbei findest du die Rechnung für Juli 2026.\n\nLiebe Grüße und einen sonnigen Tag,\nHannes Duve",
    );
    expect(href).toBe(
      "mailto:hannah%40makeklar.de?subject=Rechnung%20Juli%202026&body=Hallo%20Hannah%2C%0A%0Aanbei%20findest%20du%20die%20Rechnung%20f%C3%BCr%20Juli%202026.%0A%0ALiebe%20Gr%C3%BC%C3%9Fe%20und%20einen%20sonnigen%20Tag%2C%0AHannes%20Duve",
    );
  });
});

describe("openMailto", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("hands mailto to the OS after an async gap (no popup open)", async () => {
    await Promise.resolve();

    const assign = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      assign,
      href: "http://localhost/invoices",
    });

    const href = buildMailtoHref(
      "hannah@makeklar.de",
      "Rechnung Juli 2026",
      "Hallo Hannah,",
    );
    openMailto(href);

    expect(assign).toHaveBeenCalledWith(href);
  });
});

describe("deliverPrepareEmail", () => {
  it("downloads the PDF even when mailto handoff is stubbed", async () => {
    const order: string[] = [];
    const downloadPdf = vi.fn(async () => {
      order.push("download");
    });
    const openMailtoHref = vi.fn((href: string) => {
      order.push(`mailto:${href.startsWith("mailto:")}`);
    });

    await deliverPrepareEmail({
      mailtoHref: buildMailtoHref(
        "hannah@makeklar.de",
        "Rechnung Juli 2026",
        "Hallo Hannah,",
      ),
      downloadPdf,
      openMailto: openMailtoHref,
    });

    expect(downloadPdf).toHaveBeenCalledOnce();
    expect(openMailtoHref).toHaveBeenCalledOnce();
    expect(order).toEqual(["download", "mailto:true"]);
  });
});
