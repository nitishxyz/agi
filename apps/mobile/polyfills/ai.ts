import "fast-text-encoding";
import "@ungap/structured-clone";
import { ReadableStream } from "web-streams-polyfill";

// Polyfill ReadableStream for streaming responses
// The AI SDK relies on the Web Streams API (ReadableStream) to handle streaming responses.
if (typeof global.ReadableStream === "undefined") {
  global.ReadableStream = ReadableStream as any;
}

// Note: fast-text-encoding automatically polyfills TextEncoder and TextDecoder on the global object.
// No further action is needed for them.
