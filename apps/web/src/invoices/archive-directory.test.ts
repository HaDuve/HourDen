import { describe, expect, it, vi } from "vitest";
import {
  isLocalArchiveSupported,
  writePdfUnderArchiveRoot,
  tryArchiveIssuedPdf,
  type ArchiveDirectoryHandle,
  type ArchiveRootStore,
} from "./archive-directory.js";

function notFound(): never {
  throw new DOMException("missing", "NotFoundError");
}

/** jsdom Blob lacks arrayBuffer — use a minimal Blob-like for archive write tests. */
function pdfBlob(content: string): Blob {
  const bytes = new TextEncoder().encode(content);
  return {
    size: bytes.byteLength,
    type: "application/pdf",
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as Blob;
}

function memoryDir(name: string, files = new Map<string, Uint8Array>()): {
  handle: ArchiveDirectoryHandle;
  files: Map<string, Uint8Array>;
  dirs: Map<string, ReturnType<typeof memoryDir>>;
} {
  const dirs = new Map<string, ReturnType<typeof memoryDir>>();
  const handle: ArchiveDirectoryHandle = {
    name,
    queryPermission: vi.fn(async (): Promise<PermissionState> => "granted"),
    requestPermission: vi.fn(async (): Promise<PermissionState> => "granted"),
    async getDirectoryHandle(childName, opts) {
      const existing = dirs.get(childName);
      if (existing) return existing.handle;
      if (!opts?.create) notFound();
      const child = memoryDir(childName);
      dirs.set(childName, child);
      return child.handle;
    },
    async getFileHandle(fileName, opts) {
      if (!files.has(fileName) && !opts?.create) notFound();
      if (!files.has(fileName) && opts?.create) {
        files.set(fileName, new Uint8Array());
      }
      return {
        async createWritable() {
          const chunks: Uint8Array[] = [];
          return {
            async write(data: Blob | BufferSource | string) {
              if (typeof data === "string") {
                chunks.push(new TextEncoder().encode(data));
                return;
              }
              if (data instanceof ArrayBuffer) {
                chunks.push(new Uint8Array(data));
                return;
              }
              if (ArrayBuffer.isView(data)) {
                chunks.push(
                  new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
                );
                return;
              }
              const blob = data as Blob;
              chunks.push(new Uint8Array(await blob.arrayBuffer()));
            },
            async close() {
              const total = chunks.reduce((n, c) => n + c.length, 0);
              const out = new Uint8Array(total);
              let offset = 0;
              for (const c of chunks) {
                out.set(c, offset);
                offset += c.length;
              }
              files.set(fileName, out);
            },
          };
        },
      };
    },
  };
  return { handle, files, dirs };
}

function memoryStore(
  initial: ArchiveDirectoryHandle | null = null,
): ArchiveRootStore & { current: ArchiveDirectoryHandle | null } {
  const store = {
    current: initial,
    async get() {
      return store.current;
    },
    async set(handle: ArchiveDirectoryHandle) {
      store.current = handle;
    },
    async clear() {
      store.current = null;
    },
  };
  return store;
}

describe("isLocalArchiveSupported", () => {
  it("is true only when showDirectoryPicker exists", () => {
    expect(isLocalArchiveSupported({} as Window)).toBe(false);
    expect(
      isLocalArchiveSupported({
        showDirectoryPicker: async () => {
          throw new Error("unused");
        },
      } as unknown as Window),
    ).toBe(true);
  });
});

describe("writePdfUnderArchiveRoot", () => {
  it("creates Recipient/year dirs and writes the PDF when absent", async () => {
    const root = memoryDir("Outgoing");
    const pdf = pdfBlob("%PDF-1");

    const result = await writePdfUnderArchiveRoot(
      root.handle,
      "BANDAO/2026/BAN2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf",
      pdf,
    );

    expect(result).toEqual({
      kind: "archived",
      relativePath:
        "BANDAO/2026/BAN2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf",
    });
    const year = root.dirs.get("BANDAO")!.dirs.get("2026")!;
    const bytes = year.files.get(
      "BAN2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf",
    );
    expect(bytes && new TextDecoder().decode(bytes)).toBe("%PDF-1");
  });

  it("skips write when the filename already exists", async () => {
    const root = memoryDir("Outgoing");
    const yearSetup = memoryDir("2026");
    yearSetup.files.set(
      "BAN2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf",
      new TextEncoder().encode("old"),
    );
    const recipient = memoryDir("BANDAO");
    recipient.dirs.set("2026", yearSetup);
    root.dirs.set("BANDAO", recipient);

    const result = await writePdfUnderArchiveRoot(
      root.handle,
      "BANDAO/2026/BAN2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf",
      pdfBlob("new"),
    );

    expect(result).toEqual({
      kind: "collision",
      filename: "BAN2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf",
    });
    expect(
      new TextDecoder().decode(
        yearSetup.files.get("BAN2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf")!,
      ),
    ).toBe("old");
  });
});

describe("tryArchiveIssuedPdf", () => {
  it("returns needs-folder when no archive root is stored", async () => {
    const result = await tryArchiveIssuedPdf({
      store: memoryStore(null),
      relativePath: "BANDAO/2026/x.pdf",
      pdf: pdfBlob("%PDF"),
      supported: true,
    });
    expect(result).toEqual({ kind: "needs-folder" });
  });

  it("returns needs-permission when readwrite is not granted", async () => {
    const root = memoryDir("Outgoing");
    root.handle.queryPermission = vi.fn(async (): Promise<PermissionState> => "prompt");
    root.handle.requestPermission = vi.fn(async (): Promise<PermissionState> => "denied");

    const result = await tryArchiveIssuedPdf({
      store: memoryStore(root.handle),
      relativePath: "BANDAO/2026/x.pdf",
      pdf: pdfBlob("%PDF"),
      supported: true,
    });
    expect(result).toEqual({ kind: "needs-permission" });
  });

  it("returns unsupported when the picker API is missing", async () => {
    const result = await tryArchiveIssuedPdf({
      store: memoryStore(null),
      relativePath: "BANDAO/2026/x.pdf",
      pdf: pdfBlob("%PDF"),
      supported: false,
    });
    expect(result).toEqual({ kind: "unsupported" });
  });

  it("archives when root + permission are ready", async () => {
    const root = memoryDir("Outgoing");
    const result = await tryArchiveIssuedPdf({
      store: memoryStore(root.handle),
      relativePath: "BANDAO/2026/x.pdf",
      pdf: pdfBlob("%PDF-ok"),
      supported: true,
    });
    expect(result).toEqual({ kind: "archived", relativePath: "BANDAO/2026/x.pdf" });
  });
});
