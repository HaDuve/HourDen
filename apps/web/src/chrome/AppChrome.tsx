import { useDocumentTitle } from "./useDocumentTitle.js";
import { useRecordingFavicon } from "./useRecordingFavicon.js";

export function AppChrome() {
  useDocumentTitle();
  useRecordingFavicon();
  return null;
}
