import { client as generatedClient } from '../generated/api/client.gen';

let configured = false;

export const getGeneratedApiClient = () => {
  if (!configured) {
    generatedClient.setConfig({
      baseUrl: window.location.origin || '',
        responseStyle: 'fields',
      throwOnError: true,
    });
    configured = true;
  }
  return generatedClient;
};
