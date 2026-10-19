import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("public beta uses a user-scoped deletion request queue", async () => {
  const [profile, migration, privacy, support] = await Promise.all([
    read("../src/components/auth/ProfileEditor.jsx"),
    read("../supabase/migrations/20261019123000_account_deletion_requests.sql"),
    read("../src/app/privacy/page.js"),
    read("../src/app/support/page.js"),
  ]);

  assert.match(profile, /Request Account Deletion/);
  assert.match(profile, /account_deletion_requests/);
  assert.doesNotMatch(profile, /functions\.invoke\(["']delete-account/);

  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.account_deletion_requests from anon/i);
  assert.match(migration, /grant select, insert on table public\.account_deletion_requests to authenticated/i);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /status = 'pending'/i);

  assert.match(privacy, /queued for manual processing/i);
  assert.match(support, /Settings/);
  assert.match(support, /Request Account Deletion/);
});
