import { base64, crypto } from "../deps.ts";

/**
 * md5 哈希
 * @param raw
 */
export function md5(raw: string): string {
  const buf = new TextEncoder().encode(raw);
  return crypto.toHashString(crypto.crypto.subtle.digestSync("MD5", buf));
}

/**
 * sha-256 哈希
 * @param raw
 */
export function sha256(raw: string): string {
  const buf = new TextEncoder().encode(raw);
  return crypto.toHashString(crypto.crypto.subtle.digestSync("SHA-256", buf));
}

/**
 * base64 解码
 * @param input
 */
// export function base64Decode(input: string) {
//   return new TextDecoder().decode(base64.decode(input));
// }
export function base64Decode(input: string): string {
  try {
    // 清理字符串
    const cleaned = input.replace(/\s+/g, ""); // 去除空格
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) {
      console.error("Invalid Base64 string format:", input.substring(0, 50));
      throw new Error("Invalid Base64 string");
    }
    return new TextDecoder().decode(base64.decode(cleaned));
  } catch (error) {
    console.error("Base64 decode error:", error);
    // 抛出错误而不是返回空字符串，这样可以触发重试机制
    throw error;
  }
}

/**
 * base64 编码
 * @param input
 */
export function base64Encode(input: string) {
  return base64.encode(input);
}

// todo: 用户登录后的token采用 aes(vid + '一个固定的随机数')
// 这样可以避免因用户删除本地缓存后重新登录，token变化的问题
export async function aes() {
  const key = await crypto.crypto.subtle.generateKey(
    { name: "AES-CBC", length: 128 },
    true,
    ["encrypt", "decrypt"],
  );
  const jwk = await crypto.crypto.subtle.exportKey("jwk", key);

  const k = await crypto.crypto.subtle.importKey("jwk", jwk, "AES-CBC", true, [
    "encrypt",
    "decrypt",
  ]);
  return k;
}
