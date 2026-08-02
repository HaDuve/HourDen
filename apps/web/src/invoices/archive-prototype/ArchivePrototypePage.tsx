import { PageMain } from "../../layout/PageMain.js";
import { ArchivePrototypeHost } from "./ArchivePrototypeHost.js";

/** Throwaway route page for archive UI variants (`/prototype`). */
export default function ArchivePrototypePage() {
  return (
    <PageMain>
      <ArchivePrototypeHost />
    </PageMain>
  );
}
