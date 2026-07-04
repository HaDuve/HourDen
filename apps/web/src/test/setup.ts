{
  const NativeRequest = globalThis.Request;
  globalThis.Request = class PatchedRequest extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      if (init?.signal) {
        const { signal: _signal, ...rest } = init;
        super(input, rest);
      } else {
        super(input, init);
      }
    }
  } as typeof Request;
}

import "./load-env.js";
import "@testing-library/jest-dom/vitest";
import "../i18n/i18n.js";
import { createMatchMedia } from "./match-media.js";

process.env.HOURDEN_OPERATOR_EMAIL ??= "operator@test.hourden.local";
process.env.HOURDEN_OPERATOR_PASSWORD ??= "TestPass1";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: createMatchMedia(false),
});
