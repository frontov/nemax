export default () => ({
  session: {
    secret: process.env.SESSION_SECRET ?? "",
    cookieDomain: process.env.COOKIE_DOMAIN ?? "localhost",
  },
});
