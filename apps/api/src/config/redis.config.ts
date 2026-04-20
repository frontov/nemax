export default () => ({
  redis: {
    url: process.env.REDIS_URL ?? "",
  },
});
