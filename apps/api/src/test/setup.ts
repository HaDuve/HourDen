import "../load-env.js";
import {
  TEST_OPERATOR_EMAIL,
  TEST_OPERATOR_PASSWORD,
} from "./operator-credentials.js";

process.env.HOURDEN_OPERATOR_EMAIL = TEST_OPERATOR_EMAIL;
process.env.HOURDEN_OPERATOR_PASSWORD = TEST_OPERATOR_PASSWORD;
