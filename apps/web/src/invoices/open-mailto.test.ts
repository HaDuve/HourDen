import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMailtoHref, openMailto } from "./open-mailto.js";

/**
 * Feedback loop for: Prepare Email builds a valid mailto but the mail app
 * never opens. Browsers treat window.open after an async gap (template fetch)
 * as a popup — often blocked (returns null) or opened as an empty tab that
 * does not hand off to the OS mail client.
 */
describe("openMailto", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("buildMailtoHref matches a real Prepare Email draft", () => {
    const href = buildMailtoHref(
      "hannah@makeklar.de",
      "Rechnung Juli 2026",
      "Hallo Hannah,\n\nanbei findest du die Rechnung für Juli 2026.\n\nLiebe Grüße und einen sonnigen Tag,\nHannes Duve",
    );
    expect(href).toBe(
      "mailto:hannah%40makeklar.de?subject=Rechnung%20Juli%202026&body=Hallo%20Hannah%2C%0A%0Aanbei%20findest%20du%20die%20Rechnung%20f%C3%BCr%20Juli%202026.%0A%0ALiebe%20Gr%C3%BC%C3%9Fe%20und%20einen%20sonnigen%20Tag%2C%0AHannes%20Duve",
    );
  });

  it("hands mailto to the mail client even when window.open is blocked after async work", async () => {
    // Stand-in for await Promise.all([loadClientMail, loadWorkspaceTemplate, ...])
    await Promise.resolve();

    const open = vi.spyOn(window, "open").mockReturnValue(null);
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

    const handedOff =
      (open.mock.results[0]?.value != null &&
        String(open.mock.calls[0]?.[0]).startsWith("mailto:")) ||
      assign.mock.calls.some((c) => String(c[0]).startsWith("mailto:")) ||
      String(window.location.href).startsWith("mailto:");

    expect(handedOff).toBe(true);
    expect(assign).toHaveBeenCalledWith(href);
    expect(open).not.toHaveBeenCalled();
  });
});
