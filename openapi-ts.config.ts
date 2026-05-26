import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './openapi/v2-phase1-openapi.json',
  output: './src/generated/api',
  plugins: [
    '@hey-api/client-fetch',
  ],
});
