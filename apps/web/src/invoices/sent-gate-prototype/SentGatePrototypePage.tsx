import { PageMain } from "../../layout/PageMain.js";
import { SentGatePrototypeHost } from "./SentGatePrototypeHost.js";

/** Throwaway route page for sent-gate UI variants (`/prototype/sent-gate`). */
export default function SentGatePrototypePage() {
  return (
    <PageMain>
      <SentGatePrototypeHost />
    </PageMain>
  );
}
