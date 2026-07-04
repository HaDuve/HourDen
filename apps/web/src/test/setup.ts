import "./load-env.js";
import "@testing-library/jest-dom/vitest";

process.env.HOURDEN_OPERATOR_EMAIL ??= "operator@test.hourden.local";
process.env.HOURDEN_OPERATOR_PASSWORD ??= "TestPass1";
