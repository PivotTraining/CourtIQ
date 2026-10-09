// Bound read-only startup/profile work. A timeout never becomes an empty account,
// and callers must ignore a late result rather than applying it to another user.
export async function authRead(promise, timeoutMs = 15000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('The sign-in service took too long. Check your connection and try again.')), timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
