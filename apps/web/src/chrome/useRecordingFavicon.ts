import { useEffect, useRef } from "react";
import { useRunningTimer } from "../running-timer/RunningTimerContext.js";
import {
  FAVICON_CANVAS_SIZE,
  FAVICON_DEFAULT_HREF,
  FAVICON_BASE_IMAGE_SRC,
  RECORDING_DOT_COLOR,
  RECORDING_DOT_INSET,
  RECORDING_DOT_RADIUS,
} from "./constants.js";

function getFaviconLink(): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (existing) {
    return existing;
  }

  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  document.head.appendChild(link);
  return link;
}

function loadBaseImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load favicon image: ${src}`));
    image.src = src;
  });
}

function composeRecordingFavicon(baseImage: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = FAVICON_CANVAS_SIZE;
  canvas.height = FAVICON_CANVAS_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    return FAVICON_DEFAULT_HREF;
  }

  context.drawImage(baseImage, 0, 0, FAVICON_CANVAS_SIZE, FAVICON_CANVAS_SIZE);
  context.fillStyle = RECORDING_DOT_COLOR;
  context.beginPath();
  context.arc(
    FAVICON_CANVAS_SIZE - RECORDING_DOT_INSET - RECORDING_DOT_RADIUS,
    FAVICON_CANVAS_SIZE - RECORDING_DOT_INSET - RECORDING_DOT_RADIUS,
    RECORDING_DOT_RADIUS,
    0,
    Math.PI * 2,
  );
  context.fill();

  return canvas.toDataURL("image/png");
}

export function useRecordingFavicon(): void {
  const { running } = useRunningTimer();
  const baseImageRef = useRef<Promise<HTMLImageElement> | null>(null);

  useEffect(() => {
    const link = getFaviconLink();

    if (!running) {
      link.href = FAVICON_DEFAULT_HREF;
      return;
    }

    let cancelled = false;
    baseImageRef.current ??= loadBaseImage(FAVICON_BASE_IMAGE_SRC);

    void baseImageRef.current.then((baseImage) => {
      if (cancelled) {
        return;
      }
      link.href = composeRecordingFavicon(baseImage);
    });

    return () => {
      cancelled = true;
      link.href = FAVICON_DEFAULT_HREF;
    };
  }, [running]);
}
