import "../load-env.js";

/** Fixed test credentials — override .env so integration tests are isolated from local operator config. */
export const TEST_OPERATOR_EMAIL = "operator@test.hourden.local";
export const TEST_OPERATOR_PASSWORD = "TestPass1";

process.env.HOURDEN_OPERATOR_EMAIL = TEST_OPERATOR_EMAIL;
process.env.HOURDEN_OPERATOR_PASSWORD = TEST_OPERATOR_PASSWORD;
