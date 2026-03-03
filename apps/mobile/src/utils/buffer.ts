import { Buffer } from "buffer";
global.Buffer = Buffer;
Buffer.prototype.subarray = function subarray(
  begin: number | undefined,
  end: number | undefined,
) {
  const result = Uint8Array.prototype.subarray.apply(this, [begin, end]);
  Object.setPrototypeOf(result, Buffer.prototype); // Explicitly add the `Buffer` prototype (adds `readUIntLE`!)
  return result;
};
