import { internalApi } from './internalApi.mjs';

export async function starterApi(path, body, signal) {
  return internalApi(path === 'trial' ? '/api/billing/trial' : '/api/starter', { body, signal });
}
