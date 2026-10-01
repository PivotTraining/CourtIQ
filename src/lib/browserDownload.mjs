// Keep the URL alive until the browser has had time to consume the click.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link);
  try { link.click(); }
  finally { setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 1500); }
}
