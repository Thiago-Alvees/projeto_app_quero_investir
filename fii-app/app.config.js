export default ({ config }) => ({
  ...config,
  scheme: config.scheme ?? "queroinvestir",
  plugins: Array.from(
    new Set([...(config.plugins ?? []), "expo-web-browser", "expo-notifications"])
  ),
  extra: {
    BRAPI_PROXY_URL: process.env.BRAPI_PROXY_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
});
