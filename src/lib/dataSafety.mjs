// Never turn a denied/failed read into an apparently empty account.
export function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}

export async function readAll(query, pageSize = 500) {
  const rows = [];
  for (let offset = 0; ; ) {
    const page = checked(await query().range(offset, offset + pageSize - 1)) || [];
    rows.push(...page);
    if (page.length === 0) return rows;
    offset += page.length;
  }
}

export function requireSavedRow(result, operation) {
  const row = checked(result);
  if (!row) throw new Error(`${operation} was not saved. Please try again.`);
  return row;
}
