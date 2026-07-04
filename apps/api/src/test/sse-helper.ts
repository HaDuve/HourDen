export async function readNextSseEvent(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs = 5000,
): Promise<{ event: string; data: string }> {
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const readPromise = reader.read();
    const timeoutPromise = new Promise<ReadableStreamReadResult<Uint8Array>>(
      (resolve) => {
        setTimeout(
          () => resolve({ done: true, value: undefined }),
          remaining,
        );
      },
    );

    const { done, value } = await Promise.race([readPromise, timeoutPromise]);
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const match = buffer.match(/event: ([^\n]+)\ndata: ([^\n]*)\n\n/);
    if (match) {
      return { event: match[1], data: match[2] };
    }
  }

  throw new Error("Timed out waiting for SSE event");
}

export async function readSseComment(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  comment: string,
  timeoutMs = 5000,
): Promise<boolean> {
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  const needle = `: ${comment}\n\n`;

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const readPromise = reader.read();
    const timeoutPromise = new Promise<ReadableStreamReadResult<Uint8Array>>(
      (resolve) => {
        setTimeout(
          () => resolve({ done: true, value: undefined }),
          remaining,
        );
      },
    );

    const { done, value } = await Promise.race([readPromise, timeoutPromise]);
    if (done && buffer.length === 0) {
      return false;
    }

    if (value) {
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes(needle)) {
        return true;
      }
    }

    if (done) {
      return buffer.includes(needle);
    }
  }

  return false;
}

export async function expectStreamClosed(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs = 500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { done } = await reader.read();
    if (done) {
      return;
    }
  }

  throw new Error("Timed out waiting for SSE stream to close");
}
