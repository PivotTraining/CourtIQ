// Bounded same-origin requests. Never retry a write automatically: an interrupted
// response does not prove the server did not save the user's action.
export async function internalApi(path, { body, method = body ? 'POST' : 'GET', signal, timeoutMs = 15000 } = {}, fetcher = fetch) {
  if (typeof path !== 'string' || !/^\/api\/[a-z0-9/-]+$/i.test(path) || !['GET','POST','PATCH'].includes(method))
    throw new Error('Unsupported application request.');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000)
    throw new Error('Invalid request timeout.');
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal?.aborted) throw signal.reason || new DOMException('Request canceled.', 'AbortError');
  signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetcher(path, { method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal,
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    let result;
    try { result = await response.json(); } catch {
      if (controller.signal.aborted) throw controller.signal.reason;
      throw new Error('The server returned an unreadable response. Refresh verified status before trying again.');
    }
    if (!result || Array.isArray(result) || typeof result !== 'object')
      throw new Error('The server returned an invalid response. Please refresh and try again.');
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Your request could not complete. Please retry.');
    return result;
  } catch (error) {
    if (signal?.aborted) throw signal.reason || new DOMException('Request canceled.', 'AbortError');
    if (timedOut) throw new Error('The request took too long. Refresh verified status before trying again; the action may already have completed.');
    if (error instanceof TypeError) throw new Error('Unable to reach CourtIQ. Check your connection and refresh verified status before trying again.');
    throw error;
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
  }
}
