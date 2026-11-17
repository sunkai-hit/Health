/** Application-layer AES-256-GCM for synthetic MVP data.
 * No production key rotation, recovery or professional security review yet.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();
function bytes(b64:string):Uint8Array {
  const binary = atob(b64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function getBlob(value:unknown):Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return new Uint8Array(value as number[]);
  throw new Error('UNREADABLE_CIPHERTEXT');
}
export async function importKey(base64:string|undefined):Promise<CryptoKey> {
  if (!base64) throw new Error('DEMO_KEY_NOT_CONFIGURED');
  const raw = bytes(base64);
  if (raw.byteLength !== 32) throw new Error('DEMO_KEY_INVALID');
  const copy = new Uint8Array(raw.byteLength);
  copy.set(raw);
  return crypto.subtle.importKey('raw',copy.buffer,'AES-GCM',false,['encrypt','decrypt']);
}
export async function encrypt(key:CryptoKey, context:string, data:unknown):Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = enc.encode(JSON.stringify(data));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({
    name:'AES-GCM',iv,additionalData:enc.encode(context)
  },key,plaintext));
  const result = new Uint8Array(1+12+ciphertext.byteLength);
  result[0] = 1;
  result.set(iv,1);
  result.set(ciphertext,13);
  return result.buffer;
}
export async function decrypt<T>(key:CryptoKey, context:string, encrypted:unknown):Promise<T> {
  const all = getBlob(encrypted);
  if (all.length < 30 || all[0] !== 1) throw new Error('UNSUPPORTED_CIPHER_VERSION');
  const plain = await crypto.subtle.decrypt({
    name:'AES-GCM',iv:all.slice(1,13),additionalData:enc.encode(context)
  },key,all.slice(13));
  return JSON.parse(dec.decode(plain)) as T;
}
