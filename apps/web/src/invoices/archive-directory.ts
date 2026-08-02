/** Chromium File System Access — local archive root under Operator-chosen folder. */

export type PermissionMode = "readwrite";

export type ArchiveWritable = {
  write(data: Blob | BufferSource | string): Promise<void>;
  close(): Promise<void>;
};

export type ArchiveFileHandle = {
  createWritable(): Promise<ArchiveWritable>;
};

export type ArchiveDirectoryHandle = {
  name: string;
  queryPermission(descriptor: { mode: PermissionMode }): Promise<PermissionState>;
  requestPermission(descriptor: {
    mode: PermissionMode;
  }): Promise<PermissionState>;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<ArchiveDirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<ArchiveFileHandle>;
};

export type ArchiveRootStore = {
  get(): Promise<ArchiveDirectoryHandle | null>;
  set(handle: ArchiveDirectoryHandle): Promise<void>;
  clear(): Promise<void>;
};

export type ArchiveWriteResult =
  | { kind: "archived"; relativePath: string }
  | { kind: "collision"; filename: string }
  | { kind: "needs-folder" }
  | { kind: "needs-permission" }
  | { kind: "unsupported" }
  | { kind: "aborted" }
  | { kind: "error"; message: string };

const IDB_NAME = "hourden-invoice-archive";
const IDB_STORE = "handles";
const IDB_KEY = "archiveRoot";
const PICKER_ID = "hourden-invoice-archive";

export function isLocalArchiveSupported(
  win: Window = typeof window !== "undefined" ? window : ({} as Window),
): boolean {
  return typeof (win as Window & { showDirectoryPicker?: unknown })
    .showDirectoryPicker === "function";
}

function openArchiveIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export function createIndexedDbArchiveRootStore(): ArchiveRootStore {
  return {
    async get() {
      const db = await openArchiveIdb();
      try {
        return await new Promise<ArchiveDirectoryHandle | null>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readonly");
          const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
          req.onerror = () => reject(req.error ?? new Error("idb get failed"));
          req.onsuccess = () =>
            resolve((req.result as ArchiveDirectoryHandle | undefined) ?? null);
        });
      } finally {
        db.close();
      }
    },
    async set(handle) {
      const db = await openArchiveIdb();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readwrite");
          const req = tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
          req.onerror = () => reject(req.error ?? new Error("idb put failed"));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error("idb put tx failed"));
        });
      } finally {
        db.close();
      }
    },
    async clear() {
      const db = await openArchiveIdb();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readwrite");
          const req = tx.objectStore(IDB_STORE).delete(IDB_KEY);
          req.onerror = () => reject(req.error ?? new Error("idb delete failed"));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error("idb delete tx failed"));
        });
      } finally {
        db.close();
      }
    },
  };
}

export async function ensureArchiveReadWrite(
  handle: ArchiveDirectoryHandle,
): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  if ((await handle.requestPermission(opts)) === "granted") return true;
  return false;
}

async function fileExists(
  dir: ArchiveDirectoryHandle,
  name: string,
): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotFoundError") return false;
    throw err;
  }
}

/** Write PDF at `{RECIPIENT}/{year}/{filename}` under root; skip if file exists. */
export async function writePdfUnderArchiveRoot(
  root: ArchiveDirectoryHandle,
  relativePath: string,
  pdf: Blob,
): Promise<Extract<ArchiveWriteResult, { kind: "archived" | "collision" }>> {
  const parts = relativePath.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`invalid archive relative path: ${relativePath}`);
  }
  const filename = parts[parts.length - 1]!;
  const dirSegments = parts.slice(0, -1);

  let dir = root;
  for (const segment of dirSegments) {
    dir = await dir.getDirectoryHandle(segment, { create: true });
  }

  if (await fileExists(dir, filename)) {
    return { kind: "collision", filename };
  }

  const file = await dir.getFileHandle(filename, { create: true });
  const writable = await file.createWritable();
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  await writable.write(bytes);
  await writable.close();
  return { kind: "archived", relativePath };
}

export async function pickArchiveDirectory(
  win: Window = window,
): Promise<ArchiveDirectoryHandle | "aborted"> {
  const picker = (
    win as Window & {
      showDirectoryPicker?: (opts: {
        mode: "readwrite";
        id?: string;
      }) => Promise<ArchiveDirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (typeof picker !== "function") {
    throw new Error("showDirectoryPicker unavailable");
  }
  try {
    return await picker({ mode: "readwrite", id: PICKER_ID });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "aborted";
    }
    throw err;
  }
}

export async function pickAndStoreArchiveRoot(options?: {
  store?: ArchiveRootStore;
  win?: Window;
}): Promise<ArchiveDirectoryHandle | "aborted"> {
  const store = options?.store ?? createIndexedDbArchiveRootStore();
  const picked = await pickArchiveDirectory(options?.win);
  if (picked === "aborted") return "aborted";
  await store.set(picked);
  return picked;
}

export async function tryArchiveIssuedPdf(input: {
  relativePath: string;
  pdf: Blob;
  store?: ArchiveRootStore;
  supported?: boolean;
}): Promise<ArchiveWriteResult> {
  const supported =
    input.supported ?? isLocalArchiveSupported();
  if (!supported) return { kind: "unsupported" };

  const store = input.store ?? createIndexedDbArchiveRootStore();
  let root: ArchiveDirectoryHandle | null;
  try {
    root = await store.get();
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "archive store read failed",
    };
  }

  if (!root) return { kind: "needs-folder" };

  try {
    if (!(await ensureArchiveReadWrite(root))) {
      return { kind: "needs-permission" };
    }
    return await writePdfUnderArchiveRoot(root, input.relativePath, input.pdf);
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      return { kind: "needs-permission" };
    }
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "archive write failed",
    };
  }
}

export async function loadArchiveFolderLabel(
  store: ArchiveRootStore = createIndexedDbArchiveRootStore(),
): Promise<{ status: "unset" | "set"; name?: string }> {
  const root = await store.get();
  if (!root) return { status: "unset" };
  return { status: "set", name: root.name };
}
