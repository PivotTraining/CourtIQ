import { createServerSupabaseClient } from '@/lib/supabase-server';
import { summarizeCoachEvidence, coachQuestion, coachEvidenceSummary } from '@/lib/aiCoachEvidence.mjs';
import { configuredCoach, runGroundedCoach } from '@/lib/aiCoachProvider.mjs';
export const runtime = 'nodejs';
export const maxDuration = 20;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (data, status=200) => Response.json(data, { status, headers: {
  'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' } });

function trustedOrigin(request) {
  try {
    const configured = new URL(process.env.COURTIQ_APP_URL);
    if (configured.protocol !== 'https:' && !(configured.protocol === 'http:' && ['localhost','127.0.0.1'].includes(configured.hostname))) return false;
    return request.headers.get('origin') === configured.origin;
  } catch { return false; }
}

export async function POST(request) {
  if (process.env.COURTIQ_AI_COACH_ENABLED !== 'true') return reply({ error: 'AI Coach is not activated.' }, 503);
  if (!trustedOrigin(request)) return reply({ error: 'Open AI Coach directly from CourtIQ.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'JSON required.' }, 415);
  const raw = await request.text().catch(()=>null);
  if (!raw || raw.length > 2048) return reply({ error: 'Request is too large or unavailable.' }, 413);

  let body;
  try { body = JSON.parse(raw); } catch { return reply({ error: 'Invalid request.' }, 400); }
  if (!body || Array.isArray(body) || Object.keys(body).some(key => !['playerId','question','consent'].includes(key)) ||
    !uuid.test(body.playerId ?? '') || body.consent !== true) {
    return reply({ error: 'Select a player and explicitly approve sending aggregated results to the AI provider.' }, 400);
  }
  const question = coachQuestion(body.question);
  if (!question.ok) return reply({ error: question.reason }, 400);
  if (!configuredCoach()) return reply({ error: 'AI Coach provider is not configured.' }, 503);

  try {
    const client = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user || user.is_anonymous) return reply({ error: 'Sign in first.' }, 401);
    if (!user.email_confirmed_at) return reply({ error: 'Verify your account email before using AI Coach.' }, 403);

    const { data: profile, error: profileError } = await client.from('players')
      .select('id,age').eq('id', body.playerId).eq('manager_uid', user.id).maybeSingle();
    if (profileError) throw new Error('Profile access unavailable.');
    if (!profile) return reply({ error: 'That player is not available to this account.' }, 404);
    // Explicit pilot restriction. The current app has no verifiable guardian AI consent system.
    if (!Number.isInteger(profile.age) || profile.age < 18)
      return reply({ error: 'AI Coach is limited to adult player profiles during this pilot. Youth consent safeguards are not yet available.' }, 403);

    const { data: sessions, error: sessionsError } = await client.from('sessions')
      .select('id,type,date,tracker_status,coverage_confirmed,game_stats')
      .eq('player_id', profile.id).eq('type','game').eq('tracker_status','completed')
      .order('date', { ascending: false }).limit(12);
    if (sessionsError) throw new Error('Game records unavailable.');
    const ids = (sessions || []).filter(s=>s.coverage_confirmed===true).map(s=>s.id);
    const [shotsRead, workoutsRead] = await Promise.all([
      ids.length ? client.from('shot_logs').select('session_id,zone_id,made')
        .eq('player_id', profile.id).in('session_id', ids).limit(2001) : Promise.resolve({data:[],error:null}),
      client.from('workout_results').select('completed_at,drills')
        .eq('player_id', profile.id).order('completed_at',{ascending:false}).limit(75),
    ]);
    if (shotsRead.error || workoutsRead.error || (shotsRead.data || []).length > 2000)
      throw new Error('Evidence read incomplete.');

    const evidence = summarizeCoachEvidence({
      sessions: sessions || [], shots: shotsRead.data || [], workouts: workoutsRead.data || [],
    });
    if (!evidence.eligibleGames && !evidence.recentPracticeAssessments.length)
      return reply({ answer: coachEvidenceSummary(evidence), evidence: {
        eligibleGames: 0, gameFieldGoals: evidence.gameFieldGoals, practiceGroups: 0,
      }, mode: 'records-needed' });

    // This RPC is required for the pilot to run; no in-memory / client bypass.
    const { data: claimed, error: quotaError } = await client.rpc('claim_courtiq_ai_request');
    if (quotaError) throw new Error('Quota cannot be verified.');
    if (claimed !== true)
      return reply({ error: 'AI Coach request limit or cooldown reached. Please try another time.' }, 429);

    // Do not send player IDs, name, age, email, notes, journals or videos.
    const answer = await runGroundedCoach({ question: question.question, evidence });
    return reply({
      answer, mode: 'grounded-ai',
      evidence: { eligibleGames: evidence.eligibleGames,
        gameFieldGoals: evidence.gameFieldGoals, practiceGroups: evidence.recentPracticeAssessments.length,
        provenance: evidence.provenance },
    });
  } catch {
    // Never log question, player ID, provider body or private game records.
    return reply({ error: 'AI Coach could not safely verify or analyze these records. Try again later.' }, 503);
  }
}
