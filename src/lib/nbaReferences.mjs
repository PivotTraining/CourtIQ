// Frozen historical comparison subset, not a live feed or an NBA endorsement.
// Per-game figures transcribed from NBA's 2024–25 REGULAR SEASON official leaders.
// Ratios use published rounded values; original game totals are not inferred.
export const NBA_REFERENCE_SEASON = '2024–25 regular season';
export const NBA_REFERENCE_SOURCES = Object.freeze([
  'https://www.nba.com/stats/leaders?Season=2024-25&SeasonType=Regular+Season&StatCategory=MIN',
  'https://www.nba.com/stats/leaders?Season=2024-25&SeasonType=Regular+Season&StatCategory=AST',
]);
export const NBA_REFERENCES = Object.freeze([
  { name: 'Shai Gilgeous-Alexander', fga: 21.8, threeAttempts: 5.7, fta: 8.8, ast: 6.4, reb: 5.0, stl: 1.7, blk: 1.0 },
  { name: 'Giannis Antetokounmpo', fga: 19.7, threeAttempts: .9, fta: 10.6, ast: 6.5, reb: 11.9, stl: .9, blk: 1.2 },
  { name: 'Nikola Jokić', fga: 19.5, threeAttempts: 4.7, fta: 6.4, ast: 10.2, reb: 12.7, stl: 1.8, blk: .6 },
  { name: 'Tyrese Haliburton', fga: 13.8, threeAttempts: 7.7, fta: 3.0, ast: 9.2, reb: 3.5, stl: 1.4, blk: .7 },
  { name: 'Rudy Gobert', fga: 7.1, threeAttempts: 0, fta: 3.8, ast: 1.8, reb: 10.9, stl: .8, blk: 1.4 },
  { name: 'Cade Cunningham', fga: 20.8, threeAttempts: 6.0, fta: 5.3, ast: 9.1, reb: 6.1, stl: 1.0, blk: .8 },
  { name: 'James Harden', fga: 16.4, threeAttempts: 8.5, fta: 7.3, ast: 8.7, reb: 5.8, stl: 1.5, blk: .7 },
  { name: 'Coby White', fga: 15.1, threeAttempts: 7.9, fta: 4.1, ast: 4.5, reb: 3.7, stl: .9, blk: .2 },
].map(Object.freeze));
