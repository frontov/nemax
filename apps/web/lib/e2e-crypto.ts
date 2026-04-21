const STORAGE_KEY = "family-chat:e2e-key:v1";

type EncryptedMessage = {
  v: 1;
  alg: "AES-GCM";
  iv: string;
  data: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function getBrowserCrypto() {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return null;
  }

  return window.crypto;
}

async function importFamilyKey(rawKey: string) {
  const crypto = getBrowserCrypto();

  if (!crypto) {
    throw new Error("Шифрование недоступно в этом браузере");
  }

  return crypto.subtle.importKey(
    "raw",
    base64UrlToBytes(rawKey),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export function getStoredFamilyKey() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(STORAGE_KEY);
}

export function storeFamilyKey(rawKey: string) {
  if (typeof window === "undefined" || !rawKey) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, rawKey);
}

export function readFamilyKeyFromLocationHash() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return params.get("key");
}

export function storeFamilyKeyFromLocationHash() {
  const key = readFamilyKeyFromLocationHash();

  if (key) {
    storeFamilyKey(key);
  }

  return key;
}

export async function getOrCreateFamilyKey() {
  const storedKey = getStoredFamilyKey();

  if (storedKey) {
    return storedKey;
  }

  const crypto = getBrowserCrypto();

  if (!crypto) {
    throw new Error("Шифрование недоступно в этом браузере");
  }

  const key = new Uint8Array(32);
  crypto.getRandomValues(key);

  const rawKey = bytesToBase64Url(key);
  storeFamilyKey(rawKey);

  return rawKey;
}

export function appendFamilyKeyToUrl(url: string, rawKey: string) {
  return `${url}#key=${encodeURIComponent(rawKey)}`;
}

export function isEncryptedMessage(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const parsed = JSON.parse(value) as Partial<EncryptedMessage>;
    return parsed.v === 1 && parsed.alg === "AES-GCM" && Boolean(parsed.iv) && Boolean(parsed.data);
  } catch {
    return false;
  }
}

export async function encryptMessageText(plainText: string, rawKey: string) {
  const crypto = getBrowserCrypto();

  if (!crypto) {
    throw new Error("Шифрование недоступно в этом браузере");
  }

  const key = await importFamilyKey(rawKey);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    textEncoder.encode(plainText),
  );

  return JSON.stringify({
    v: 1,
    alg: "AES-GCM",
    iv: bytesToBase64Url(iv),
    data: bytesToBase64Url(new Uint8Array(encrypted)),
  } satisfies EncryptedMessage);
}

export async function decryptMessageText(value: string | null | undefined, rawKey: string | null) {
  if (!value) {
    return value;
  }

  if (!isEncryptedMessage(value)) {
    return "🔒 Старое незашифрованное сообщение скрыто.";
  }

  const browserCrypto = getBrowserCrypto();

  if (!browserCrypto) {
    throw new Error("Шифрование недоступно в этом браузере");
  }

  if (!rawKey) {
    return "🔒 Сообщение зашифровано. Откройте чат по семейной ссылке или QR-коду.";
  }

  const parsed = JSON.parse(value) as EncryptedMessage;
  const key = await importFamilyKey(rawKey);
  const decrypted = await browserCrypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64UrlToBytes(parsed.iv),
    },
    key,
    base64UrlToBytes(parsed.data),
  );

  return textDecoder.decode(decrypted);
}
