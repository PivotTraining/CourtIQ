export async function starterApi(path, body, signal) {
  const response = await fetch(path === 'trial' ? '/api/billing/trial' : '/api/starter', {
    method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Your access could not load. Please retry.');
  return result;
}
