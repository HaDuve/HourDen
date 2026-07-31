# File System Access API — archive directory pattern (2026)

Research for [How does Chrome persist a writable archive-directory handle for HourDen?](https://github.com/HaDuve/HourDen/issues/119) — HourDen’s “Issue then archive” flow: pick a local archive root with `readwrite`, persist the handle across visits, re-check/`requestPermission`, create `{RECIPIENT}/{year}/`, write a PDF without overwriting an existing file, and hide the feature where local-disk pickers are unavailable.

**Not** the Origin Private File System (`navigator.storage.getDirectory()`). OPFS is sandboxed and invisible to the user; Safari/Firefox ship OPFS but **not** local-disk pickers. Gate on the picker, not on `FileSystemDirectoryHandle`.

## Sources (primary)

| Source | URL |
|--------|-----|
| MDN `showDirectoryPicker` | https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker |
| MDN `queryPermission` | https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission |
| MDN `requestPermission` | https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission |
| MDN `getDirectoryHandle` | https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getDirectoryHandle |
| MDN `getFileHandle` | https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getFileHandle |
| MDN `createWritable` | https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable |
| MDN OPFS (contrast) | https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system |
| WICG File System Access | https://wicg.github.io/file-system-access/ |
| WHATWG File System Standard | https://fs.spec.whatwg.org/ |
| Chrome capabilities guide | https://developer.chrome.com/docs/capabilities/web-apis/file-system-access |
| Chrome persistent permissions (122+) | https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api |
| MDN BCD `Window.showDirectoryPicker` | https://github.com/mdn/browser-compat-data (`api/Window.json`) |

---

## 1. Feature detection (hide on Safari / Firefox)

Gate the archive UI on the **local directory picker**, not on handle types (those exist for OPFS everywhere modern browsers ship OPFS).

```js
const canPickLocalDirectory =
  typeof window !== "undefined" &&
  "showDirectoryPicker" in window;
```

Chrome’s guide recommends the same shape for pickers (`'showOpenFilePicker' in self`). ([Chrome docs](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access))

**Why not** `'FileSystemDirectoryHandle' in window` or `navigator.storage.getDirectory`? Those succeed on Safari/Firefox for OPFS only; they do **not** mean the user can pick a visible disk folder. ([MDN OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system), [Chrome OPFS section](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access))

Also require a [secure context](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker) (HTTPS / localhost).

MDN BCD (fetched 2026-07-31): `showDirectoryPicker` → Chrome `86`, Chrome Android `132`, Edge/Opera mirror; **Firefox `false`**, **Safari `false`**, **Safari iOS `false`**.

---

## 2. Picking a directory (`showDirectoryPicker` + mode)

```js
const root = await window.showDirectoryPicker({
  mode: "readwrite", // default is "read"
  id: "hourden-invoice-archive", // optional: remember last dir per id
  startIn: "documents", // optional: well-known dir or prior handle
});
```

- `mode: "readwrite"` — WICG allows combining read+write into one subsequent prompt; default is `"read"`. ([WICG §3.5](https://wicg.github.io/file-system-access/#api-showdirectorypicker), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker))
- **Transient user activation** required (button click, etc.). Else `SecurityError`. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker))
- User cancel / sensitive folder / permission not granted → `AbortError`. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker), [WICG](https://wicg.github.io/file-system-access/#api-showdirectorypicker))
- Cross-origin iframe / third-party context: local pickers and `requestPermission` are blocked. ([WICG §5.3](https://wicg.github.io/file-system-access/#security-third-party))

---

## 3. Persisting the handle across visits

**Store the `FileSystemDirectoryHandle` in IndexedDB** (handles are `[Serializable]`). Chrome documents IDB (or `postMessage` within the same top-level origin) as the supported pattern — same approach VS Code Web uses. ([Chrome docs — storing handles](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access), [WICG](https://wicg.github.io/file-system-access/) `Serializable` on `FileSystemHandle`)

- **Not** `localStorage` / `JSON.stringify` (handles are not JSON).
- **Not** `StorageManager` for local-disk archive roots. `navigator.storage.getDirectory()` is OPFS only. ([MDN OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system))
- Clearing site data clears persisted handles. ([WICG security notes](https://wicg.github.io/file-system-access/))

### Permission durability (Chrome-specific)

Default (Chrome capabilities guide): write access lasts until **all tabs for the origin close**; next visit needs re-grant. ([Chrome — Permission persistence](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access))

**Chrome 122+** optional persistent grant ([blog](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)):

1. Prior visit granted access; app stored handle(s) in IndexedDB.
2. Next visit: load handle from IDB → call `requestPermission()`.
3. User may see a three-way prompt: **Allow this time** / **Allow on every visit** / **Don't allow**.
4. **Installed** (PWA) apps auto-persist once granted (no three-way prompt).
5. Users can revoke per-item in site settings or via the address-bar file-editing control.

HourDen cannot force “Allow on every visit”; only the user (or install-as-app) can.

---

## 4. Return visit: `queryPermission` / `requestPermission`

```js
async function ensureReadWrite(handle) {
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  // Must run under transient user activation when a prompt is needed
  if ((await handle.requestPermission(opts)) === "granted") return true;
  return false;
}
```

Canonical pattern from [MDN `requestPermission`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission) and [Chrome docs](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access).

| Fact | Source |
|------|--------|
| States: `"granted"` \| `"denied"` \| `"prompt"` | [MDN `queryPermission`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission) |
| Handle from IndexedDB often resolves `"prompt"` | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission), [WICG](https://wicg.github.io/file-system-access/) |
| `"prompt"` → call `requestPermission()` before ops | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission) |
| `"denied"` → operations reject | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission) |
| `requestPermission` needs **transient user activation**; else `SecurityError` | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission) |
| Cross-origin iframe → `SecurityError` | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission), [WICG §5.3](https://wicg.github.io/file-system-access/#security-third-party) |
| Workers cannot consume user activation for the prompt | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission) |

**UX implication for HourDen:** on load, only `queryPermission`. If not `"granted"`, show “Unlock archive folder” (or fold into “Issue & archive”) so `requestPermission` runs from a click. Do not call `requestPermission` from an unattended page-load effect.

---

## 5. Creating nested dirs `{RECIPIENT}/{year}/`

Chain `getDirectoryHandle` with `{ create: true }`:

```js
const recipientDir = await root.getDirectoryHandle(recipientSlug, {
  create: true,
});
const yearDir = await recipientDir.getDirectoryHandle(String(year), {
  create: true,
});
```

- `create: true` — create if missing; return existing if present. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getDirectoryHandle), [Chrome](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access), [WHATWG FS §2.4.3](https://fs.spec.whatwg.org/#api-filesystemdirectoryhandle-getdirectoryhandle))
- `create: true` requires **`readwrite`** permission; `create: false` needs `read`. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getDirectoryHandle))
- Name is a file → `TypeMismatchError`. Invalid name → `TypeError`. Missing + `create: false` → `NotFoundError`. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getDirectoryHandle))

Sanitize `RECIPIENT` for filesystem-illegal characters before use (browser/`TypeError` for “characters that would interfere with the native file system”). ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getDirectoryHandle))

---

## 6. Writing a PDF without overwrite

There is **no** exclusive-create flag. `{ create: true }` returns an **existing** file if present — it does not fail. ([WHATWG FS §2.4.2](https://fs.spec.whatwg.org/#api-filesystemdirectoryhandle-getfilehandle), historical discussion [WICG#107](https://github.com/WICG/file-system-access/issues/107))

### Detect existing file

```js
async function fileExists(dir, name) {
  try {
    await dir.getFileHandle(name); // create defaults to false
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "NotFoundError") return false;
    throw e; // TypeMismatchError, NotAllowedError, etc.
  }
}
```

| Call | Meaning |
|------|---------|
| `getFileHandle(name)` / `{ create: false }` | Existing file → handle; missing → **`NotFoundError`** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getFileHandle), [WHATWG](https://fs.spec.whatwg.org/#api-filesystemdirectoryhandle-getfilehandle)) |
| `getFileHandle(name, { create: true })` | Create **or** open existing; needs `readwrite` even if file already exists ([WHATWG](https://fs.spec.whatwg.org/#api-filesystemdirectoryhandle-getfilehandle)) |
| Name is a directory | `TypeMismatchError` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getFileHandle)) |
| No permission | `NotAllowedError` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getFileHandle)) |

### Create + write only if absent

```js
if (await fileExists(yearDir, pdfName)) {
  throw new Error("ARCHIVE_FILE_EXISTS"); // HourDen: skip / rename / prompt
}

const fileHandle = await yearDir.getFileHandle(pdfName, { create: true });
const writable = await fileHandle.createWritable(); // keepExistingData default false
await writable.write(pdfBlob); // Blob / BufferSource / string OK
await writable.close(); // changes land on disk only after close
```

`createWritable` notes ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable)):

- Needs `readwrite`; else `NotAllowedError`.
- Default `keepExistingData: false` → temp file starts empty (fine for new files).
- Data is not visible on disk until the stream is **closed**.
- Concurrent exclusive lock → `NoModificationAllowedError` when `mode: "exclusive"`.

**Race:** two tabs can both observe `NotFoundError` then both create. No atomic create-if-absent in the standard; HourDen should treat “exists” as soft conflict and prefer unique filenames (invoice id) plus UI if collision.

---

## 7. Minimal “Issue then archive” sequence

```text
0. if (!("showDirectoryPicker" in window)) → hide archive UI; download/share only
1. First setup (user click):
     root = await showDirectoryPicker({ mode: "readwrite", id: "hourden-invoice-archive" })
     await idb.put("archiveRoot", root)
2. Later visit / before archive (user click on Issue & archive):
     root = await idb.get("archiveRoot")
     if (!root) → go to (1)
     if (!(await ensureReadWrite(root))) → abort / re-pick
3. recipientDir = await root.getDirectoryHandle(RECIPIENT, { create: true })
4. yearDir     = await recipientDir.getDirectoryHandle(year, { create: true })
5. if (await fileExists(yearDir, pdfName)) → do not write; surface conflict
6. file = await yearDir.getFileHandle(pdfName, { create: true })
7. w = await file.createWritable(); await w.write(pdfBlob); await w.close()
```

Keep (2)–(7) inside one user-gesture chain when permission may be `"prompt"`.

---

## 8. Known limitations / browser support

| Capability | Chrome / Edge / Opera | Firefox | Safari |
|------------|----------------------|---------|--------|
| `showDirectoryPicker` (local disk) | Yes (Chrome 86+, Android 132+) | **No** | **No** |
| `queryPermission` / `requestPermission` on local handles | Yes (Chromium) | N/A for local pickers | N/A |
| Persist handle in IndexedDB | Yes | N/A for this flow | N/A |
| OPFS `navigator.storage.getDirectory` | Yes | Yes (modern) | Yes (modern) |
| Persist local FS permission across sessions | Opt-in Chrome 122+ / installed PWA | — | — |

Sources: [MDN BCD](https://github.com/mdn/browser-compat-data), [MDN `showDirectoryPicker`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker) (“not Baseline”), [Chrome guide](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) (Brave: flag-only exception), [Chrome persistent permissions](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api).

Cannot fully polyfill `showDirectoryPicker`; Chrome notes only weak fallbacks (`webkitdirectory`). ([Chrome — Polyfilling](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access))

---

## 9. Open risks for HourDen

| Risk | Detail |
|------|--------|
| Permission lost after restart | Default Chromium: access ends when last origin tab closes unless user chose **Allow on every visit** or app is installed. Always `queryPermission` + gesture-bound `requestPermission`. |
| User never picks “every visit” | Expect a prompt (or unlock click) most sessions. |
| Cross-origin / iframe | Pickers + `requestPermission` blocked in third-party contexts. Serve from top-level HourDen origin. |
| Private / ephemeral mode | Site storage (IDB handles) and permissions may not survive; treat as “no archive root”. |
| Site data cleared | IDB handle gone → must re-pick directory. |
| Sensitive OS folders | UA may reject with `AbortError`; guide user to a Documents-style folder. |
| Filename collisions | No exclusive create; detect with `getFileHandle` + `NotFoundError` before create. |
| Cross-device | Handle is device-local; another machine needs its own pick + IDB. |
| Safari / Firefox | Gate UI off; keep download/print path. |
| Brave | May need flag; feature-detect still correct if method absent. ([Chrome](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)) |

---

## Verdict for HourDen

Use Chromium-only File System Access: feature-detect `showDirectoryPicker`, pick with `mode: "readwrite"`, persist the directory handle in IndexedDB, re-verify with `queryPermission` / gesture-scoped `requestPermission`, nest dirs with `getDirectoryHandle(..., { create: true })`, and refuse overwrite by probing `getFileHandle(name)` for `NotFoundError` before `create: true` + `createWritable`. Hide the control wherever the picker is missing (Safari, Firefox).
