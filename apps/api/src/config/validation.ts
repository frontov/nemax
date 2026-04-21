import { z } from "zod";

const placeholderValues = new Set([
  "replace-me",
  "development-public-key",
  "development-private-key",
  "minioadmin",
]);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(1),
    MINIO_ACCESS_KEY: z.string().min(1),
    MINIO_SECRET_KEY: z.string().min(1),
    VAPID_PUBLIC_KEY: z.string().min(1),
    VAPID_PRIVATE_KEY: z.string().min(1),
    CORS_ORIGINS: z.string().optional(),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== "production") {
      return;
    }

    for (const key of ["SESSION_SECRET", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"] as const) {
      if (placeholderValues.has(env[key]) || env[key].length < 32) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: `${key} must be a non-placeholder value with at least 32 characters in production`,
        });
      }
    }

    if (!env.CORS_ORIGINS?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["CORS_ORIGINS"],
        message: "CORS_ORIGINS must be set in production",
      });
    }
  });

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}
