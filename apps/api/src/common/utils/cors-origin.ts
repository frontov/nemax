const LOCAL_DEVELOPMENT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8080",
];

export function getAllowedCorsOrigins() {
  const configuredOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  if (process.env.NODE_ENV === "production") {
    return [];
  }

  return LOCAL_DEVELOPMENT_ORIGINS;
}

export function isCorsOriginAllowed(origin?: string) {
  if (!origin) {
    return true;
  }

  return getAllowedCorsOrigins().includes(origin);
}

export function corsOrigin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
  callback(null, isCorsOriginAllowed(origin));
}
