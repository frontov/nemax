export default () => ({
  storage: {
    endpoint: process.env.MINIO_ENDPOINT ?? "minio",
    port: Number(process.env.MINIO_PORT_INTERNAL ?? 9000),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY ?? "",
    secretKey: process.env.MINIO_SECRET_KEY ?? "",
    bucket: process.env.MINIO_BUCKET ?? "family-chat",
    publicUrl: process.env.MINIO_PUBLIC_URL ?? "http://localhost:9000",
  },
});
