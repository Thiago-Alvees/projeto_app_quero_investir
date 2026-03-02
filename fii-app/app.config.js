export default ({ config }) => ({
  ...config,
  extra: {
    BRAPI_TOKEN: process.env.BRAPI_TOKEN,
    BRAPI_PROXY_URL: process.env.BRAPI_PROXY_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
});
