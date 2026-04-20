export default () => ({
  app: {
    env: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 3001),
  },
});
