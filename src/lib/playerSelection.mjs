export function selectPlayer(players, userId, preferredId) {
  return players.find((p) => p.id === preferredId)
    || players.find((p) => p.firebase_uid === userId)
    || players[0]
    || null;
}

export function preferredPlayer(userId) {
  try { return sessionStorage.getItem(`courtiq-player:${userId}`); } catch { return null; }
}

export function rememberPlayer(userId, playerId) {
  try { sessionStorage.setItem(`courtiq-player:${userId}`, playerId); } catch { /* optional preference only */ }
}
