/**
 * Browser-safe, dependency-free byte and encoding helpers shared by the agent
 * operation logic. They use only the `TextEncoder` Web global (available in
 * browsers and modern Node) and a portable base64 alphabet, so the agent
 * operation modules stay browser-importable.
 *
 * WP-WA1: these replace the former Node-only byte-length and base64 calls on
 * the read/render paths. Output is byte-identical to the Node equivalents.
 */

const textEncoder = new TextEncoder();

/** UTF-8 byte length of a string. */
export function utf8ByteLength(value: string): number {
  return textEncoder.encode(value).byteLength;
}

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Base64 of a UTF-8 string. Implemented over the UTF-8 byte sequence so
 * multibyte content round-trips identically to the Node base64 encoding.
 */
export function base64EncodeUtf8(value: string): string {
  const bytes = textEncoder.encode(value);
  let output = "";
  let index = 0;
  for (; index + 3 <= bytes.length; index += 3) {
    const byte0 = bytes[index]!;
    const byte1 = bytes[index + 1]!;
    const byte2 = bytes[index + 2]!;
    output +=
      BASE64_ALPHABET[byte0 >> 2]! +
      BASE64_ALPHABET[((byte0 & 0x03) << 4) | (byte1 >> 4)]! +
      BASE64_ALPHABET[((byte1 & 0x0f) << 2) | (byte2 >> 6)]! +
      BASE64_ALPHABET[byte2 & 0x3f]!;
  }
  const remaining = bytes.length - index;
  if (remaining === 1) {
    const byte0 = bytes[index]!;
    output +=
      BASE64_ALPHABET[byte0 >> 2]! +
      BASE64_ALPHABET[(byte0 & 0x03) << 4]! +
      "==";
  } else if (remaining === 2) {
    const byte0 = bytes[index]!;
    const byte1 = bytes[index + 1]!;
    output +=
      BASE64_ALPHABET[byte0 >> 2]! +
      BASE64_ALPHABET[((byte0 & 0x03) << 4) | (byte1 >> 4)]! +
      BASE64_ALPHABET[(byte1 & 0x0f) << 2]! +
      "=";
  }
  return output;
}
