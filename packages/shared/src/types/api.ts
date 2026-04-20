export type ApiEnvelope<T> = {
  data: T;
  meta?: Record<string, string | number | boolean | null>;
};

export type HealthResponse = {
  status: "ok";
  service: "api";
  timestamp: string;
};
