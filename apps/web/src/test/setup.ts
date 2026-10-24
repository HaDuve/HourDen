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
import { installMockEventSource } from "./mock-event-source.js";

import {
  TEST_OPERATOR_EMAIL,
  TEST_OPERATOR_PASSWORD,
} from "../../../api/src/test/operator-credentials.js";

process.env.HOURDEN_OPERATOR_EMAIL = TEST_OPERATOR_EMAIL;
process.env.HOURDEN_OPERATOR_PASSWORD = TEST_OPERATOR_PASSWORD;

installMockEventSource();

// jsdom does not implement PointerEvent; Day Ribbon paint/resize needs it in tests.
if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  globalThis.PointerEvent =
    PointerEventPolyfill as unknown as typeof PointerEvent;
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: createMatchMedia(false),
});
