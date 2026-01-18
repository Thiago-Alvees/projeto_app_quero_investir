export default ({ config }) => ({
  ...config,
  extra: {
    BRAPI_TOKEN: process.env.BRAPI_TOKEN,
  },
});
