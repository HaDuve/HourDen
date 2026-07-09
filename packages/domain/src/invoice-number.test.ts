import { describe, expect, it } from "vitest";
import {
  deriveDefaultInvoicePrefix,
  detectSeparatorStyle,
  invoiceNumberExists,
  isValidAnyInvoiceNumber,
  nextInvoiceNumber,
  nextPrefixedInvoiceNumber,
  previewNextInvoiceNumbers,
  previewNextPrefixedInvoiceNumbers,
  resolveSeparatorStyle,
} from "./invoice-number.js";

describe("deriveDefaultInvoicePrefix", () => {
  it("takes the first three letters from the Client name, uppercased", () => {
    expect(deriveDefaultInvoicePrefix("Bandao")).toBe("BAN");
    expect(deriveDefaultInvoicePrefix("Hannah")).toBe("HAN");
  });

  it("skips spaces, punctuation, and digits", () => {
    expect(deriveDefaultInvoicePrefix("123 Bandao")).toBe("BAN");
    expect(deriveDefaultInvoicePrefix("A&B Co")).toBe("ABC");
  });

  it("uses available letters when the name has fewer than three", () => {
    expect(deriveDefaultInvoicePrefix("AB")).toBe("AB");
  });
});

describe("nextPrefixedInvoiceNumber", () => {
  it("returns PREFIX+YYYY001 when no invoices exist for the Client year", () => {
    expect(nextPrefixedInvoiceNumber([], "BAN", 2026)).toBe("BAN2026001");
  });

  it("returns PREFIX-###-YYYY when sequence comes before the year with hyphens", () => {
    expect(
      nextPrefixedInvoiceNumber(
        [],
        "BAN",
        2026,
        "sequential",
        "sequence_first",
        "hyphenated",
      ),
    ).toBe("BAN-001-2026");
  });

  it("increments the per-Client per-year counter", () => {
    expect(
      nextPrefixedInvoiceNumber(["BAN2026001", "BAN2026002"], "BAN", 2026),
    ).toBe("BAN2026003");
  });

  it("counts plain-format invoices toward the same Client year counter", () => {
    expect(nextPrefixedInvoiceNumber(["2026001"], "BAN", 2026)).toBe(
      "BAN2026002",
    );
  });

  it("continues from the highest suffix when strategy is from_last", () => {
    expect(
      nextPrefixedInvoiceNumber(
        ["BAN2026001", "BAN2026010"],
        "BAN",
        2026,
        "from_last",
      ),
    ).toBe("BAN2026011");
  });
});

describe("nextInvoiceNumber", () => {
  it("returns YYYY001 when no invoices exist for the year", () => {
    expect(nextInvoiceNumber([], 2026)).toBe("2026001");
  });

  it("returns ###-YYYY when sequence comes before the year with hyphens", () => {
    expect(
      nextInvoiceNumber([], 2026, "sequential", "sequence_first", "hyphenated"),
    ).toBe("001-2026");
  });

  it("increments the sequence for the same Recipient year", () => {
    expect(nextInvoiceNumber(["2026001", "2026002"], 2026)).toBe("2026003");
  });

  it("ignores invoice numbers from other years", () => {
    expect(nextInvoiceNumber(["2025003"], 2026)).toBe("2026001");
  });

  it("ignores prefixed invoice numbers in the plain pool", () => {
    expect(nextInvoiceNumber(["BAN2026001", "HAN2026001"], 2026)).toBe(
      "2026001",
    );
  });

  it("continues from the highest issued suffix when strategy is from_last", () => {
    expect(
      nextInvoiceNumber(["2026001", "2026010"], 2026, "from_last"),
    ).toBe("2026011");
  });

  it("keeps count-based sequencing when strategy is sequential", () => {
    expect(
      nextInvoiceNumber(["2026010"], 2026, "sequential"),
    ).toBe("2026002");
  });
});

describe("previewNextInvoiceNumbers", () => {
  it("shows both future numbering options after issuing an edited number", () => {
    expect(
      previewNextInvoiceNumbers([], 2026, "2026010"),
    ).toEqual({
      sequential: "2026002",
      fromLast: "2026011",
    });
  });
});

describe("invoiceNumberExists", () => {
  it("returns true when the number is already issued for the Client", () => {
    expect(invoiceNumberExists(["2026001"], "2026001")).toBe(true);
    expect(invoiceNumberExists(["2026001"], "2026002")).toBe(false);
  });
});

describe("isValidAnyInvoiceNumber", () => {
  it("accepts hyphen-separated Invoice Numbers when hyphens are separators only", () => {
    expect(isValidAnyInvoiceNumber("BAN-2026-001", 2026)).toBe(true);
    expect(isValidAnyInvoiceNumber("2026-001", 2026)).toBe(true);
    expect(isValidAnyInvoiceNumber("001-2026", 2026)).toBe(true);
    expect(isValidAnyInvoiceNumber("BAN-001-2026", 2026)).toBe(true);
  });

  it("rejects hyphen placement that does not match allowed separator patterns", () => {
    expect(isValidAnyInvoiceNumber("BAN-20-26-001", 2026)).toBe(false);
    expect(isValidAnyInvoiceNumber("BA-N-2026-001", 2026)).toBe(false);
    expect(isValidAnyInvoiceNumber("BAN-2026-01", 2026)).toBe(false);
  });
});

describe("previewNextPrefixedInvoiceNumbers", () => {
  it("returns hyphenated next numbers when the issued number used separator hyphens", () => {
    expect(
      previewNextPrefixedInvoiceNumbers([], "BAN", 2026, "BAN-2026-010"),
    ).toEqual({
      sequential: "BAN-2026-002",
      fromLast: "BAN-2026-011",
    });
  });

  it("returns compact next numbers when the issued number was compact", () => {
    expect(
      previewNextPrefixedInvoiceNumbers([], "BAN", 2026, "BAN2026010"),
    ).toEqual({
      sequential: "BAN2026002",
      fromLast: "BAN2026011",
    });
  });
});

describe("resolveSeparatorStyle", () => {
  it("defaults to compact for year-first when the Client has no invoices", () => {
    expect(resolveSeparatorStyle(null, "year_first")).toBe("compact");
  });

  it("defaults to hyphenated for sequence-first when the Client has no invoices", () => {
    expect(resolveSeparatorStyle(null, "sequence_first")).toBe("hyphenated");
  });

  it("follows the most recent issued Invoice Number when present", () => {
    expect(detectSeparatorStyle("BAN-2026-003")).toBe("hyphenated");
    expect(detectSeparatorStyle("BAN2026003")).toBe("compact");
    expect(resolveSeparatorStyle("BAN-2026-003", "year_first")).toBe(
      "hyphenated",
    );
    expect(resolveSeparatorStyle("BAN0012026", "sequence_first")).toBe(
      "compact",
    );
  });
});

describe("compact sequence-first Invoice Numbers", () => {
  it("builds and parses compact prefixed sequence-first numbers", () => {
    expect(
      nextPrefixedInvoiceNumber(
        [],
        "BAN",
        2026,
        "sequential",
        "sequence_first",
        "compact",
      ),
    ).toBe("BAN0012026");
    expect(isValidAnyInvoiceNumber("BAN0012026", 2026)).toBe(true);
    expect(
      nextPrefixedInvoiceNumber(
        ["BAN0012026"],
        "BAN",
        2026,
        "sequential",
        "sequence_first",
        "compact",
      ),
    ).toBe("BAN0022026");
  });

  it("builds and parses compact plain sequence-first numbers", () => {
    expect(
      nextInvoiceNumber([], 2026, "sequential", "sequence_first", "compact"),
    ).toBe("0012026");
    expect(isValidAnyInvoiceNumber("0012026", 2026)).toBe(true);
  });
});

describe("hyphenated year-first Invoice Numbers", () => {
  it("builds hyphenated prefixed year-first numbers when requested", () => {
    expect(
      nextPrefixedInvoiceNumber(
        ["BAN-2026-001"],
        "BAN",
        2026,
        "sequential",
        "year_first",
        "hyphenated",
      ),
    ).toBe("BAN-2026-002");
  });

  it("builds hyphenated plain year-first numbers when requested", () => {
    expect(
      nextInvoiceNumber(
        ["2026-001"],
        2026,
        "sequential",
        "year_first",
        "hyphenated",
      ),
    ).toBe("2026-002");
  });
});
