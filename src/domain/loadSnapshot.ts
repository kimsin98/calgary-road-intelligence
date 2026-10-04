/** Handles both raw gzip assets and hosts that already decode Content-Encoding. */
export async function loadSnapshot(
  url: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw Error("Unable to load " + url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  let decoded = bytes;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream !== "undefined") {
      const stream = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));
      decoded = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      const { gunzipSync } = await import("fflate");
      decoded = gunzipSync(bytes);
    }
  }
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  return JSON.parse(new TextDecoder().decode(decoded));
}
