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
