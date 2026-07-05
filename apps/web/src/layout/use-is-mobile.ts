import { DESKTOP_MEDIA_QUERY } from "../navigation/media-query.js";
import { useMediaQuery } from "../navigation/use-media-query.js";

export function useIsMobile(): boolean {
  return !useMediaQuery(DESKTOP_MEDIA_QUERY);
}
