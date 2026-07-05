import { describe, expect, it } from "vitest";
import { readApiErrorBody } from "./read-api-error.js";

function jsonResponse(body: unknown, status = 400): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("readApiErrorBody", () => {
  it("returns a validated blocker code when the API sends a known code", async () => {
    const result = await readApiErrorBody(
      jsonResponse({
        error: "Client Recipient fields are required before invoicing",
        code: "MISSING_RECIPIENT",
      }),
    );

    expect(result).toEqual({
      error: "Client Recipient fields are required before invoicing",
      code: "MISSING_RECIPIENT",
      message: "Client Recipient fields are required before invoicing",
    });
  });

  it("drops unknown blocker codes and keeps plain text only", async () => {
    const result = await readApiErrorBody(
      jsonResponse({
        error: "Something went wrong",
        code: "NOT_A_REAL_BLOCKER",
      }),
    );

    expect(result).toEqual({
      error: "Something went wrong",
      message: "Something went wrong",
    });
    expect(result.code).toBeUndefined();
  });
});
