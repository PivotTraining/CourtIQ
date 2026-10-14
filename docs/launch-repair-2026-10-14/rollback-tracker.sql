-- FUNCTION-ONLY rollback. Never restore a whole database over customer records
-- for this change. Execute the saved function only after checking its hash.
begin;
do $$ begin
  if md5(pg_get_functiondef('public.apply_session_command(uuid,uuid,integer,jsonb)'::regprocedure))
      <> '797ea510691c3a10fba26d94e9317543' then
    raise exception 'Tracker changed since repair; inspect before rollback';
  end if;
end $$;
CREATE OR REPLACE FUNCTION public.apply_session_command(p_session uuid, p_id uuid, p_version integer, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  s public.sessions%rowtype;
  previous public.session_commands%rowtype;
  target public.session_commands%rowtype;

  kind text;
  stat text;
  delta integer;
  value numeric;
  g jsonb;
  reverse_id uuid;

begin

  if auth.uid() is null then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;


  select *
  into s
  from public.sessions
  where id = p_session
  for update;


  if not found
     or not exists (
       select 1
       from public.players
       where id = s.player_id
         and owner_id = auth.uid()
     )
  then
    raise exception
      'Session unavailable'
      using errcode = '42501';
  end if;


  if p_id is null
     or p_version is null
     or p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
  then
    raise exception 'Invalid command';
  end if;


  -- Idempotent retry support.
  -- If the client lost the response after a successful write,
  -- retrying with the same command UUID will not duplicate it.

  select *
  into previous
  from public.session_commands
  where id = p_id;

  if found then

    if previous.session_id <> p_session
       or previous.actor_id <> auth.uid()
       or previous.payload <> p_payload
    then
      raise exception
        'Idempotency key reused for a different entry';
    end if;

    return to_jsonb(s);

  end if;


  if s.tracker_status <> 'active' then
    raise exception 'Session is not active';
  end if;


  if s.tracker_version <> p_version then
    raise exception
      'SESSION_CONFLICT: another device changed this session'
      using errcode = '40001';
  end if;


  if octet_length(p_payload::text) > 4096 then
    raise exception 'Entry too large';
  end if;


  if coalesce(
       p_payload->>'period',
       '1'
     ) !~ '^[1-9][0-9]?$'
  then
    raise exception 'Invalid period';
  end if;


  if p_payload ? 'clock'
     and (p_payload->>'clock')
       !~ '^[0-9]{1,2}:[0-5][0-9]$'
  then
    raise exception 'Invalid game clock';
  end if;


  if not (p_payload ? 'recorded_at') then
    raise exception 'Entry timestamp required';
  end if;


  perform
    (p_payload->>'recorded_at')::timestamptz;


  kind := p_payload->>'kind';

  g := coalesce(
    s.game_stats,
    '{}'::jsonb
  );


  -- ==========================================================
  -- NON-SHOT STAT
  -- ==========================================================

  if kind = 'stat' then

    stat := p_payload->>'key';

    delta :=
      (p_payload->>'delta')::integer;


    if stat is null
       or stat <> all(
         array[
           'ast',
           'reb',
           'stl',
           'blk',
           'to',
           'pf',
           'min',
           'oreb',
           'dreb'
         ]
       )
       or delta is null
       or delta not in (-1, 1)
    then
      raise exception 'Invalid stat';
    end if;


    value :=
      coalesce(
        (g->>stat)::numeric,
        0
      ) + delta;


    if value < 0
       or value > 10000
    then
      raise exception 'Invalid stat total';
    end if;


    if stat = 'reb'
       and value <
         coalesce(
           (g->>'oreb')::numeric,
           0
         )
         +
         coalesce(
           (g->>'dreb')::numeric,
           0
         )
    then
      raise exception
        'Total rebounds cannot be below the recorded split';
    end if;


    g :=
      jsonb_set(
        g,
        array[stat],
        to_jsonb(value)
      );


    if stat in ('oreb', 'dreb') then

      g :=
        jsonb_set(
          g,
          array['reb'],
          to_jsonb(
            coalesce(
              (g->>'reb')::numeric,
              0
            ) + delta
          )
        );

    end if;


  -- ==========================================================
  -- SHOT
  -- ==========================================================

  elsif kind = 'shot' then

    if coalesce(
         p_payload->>'zone_id',
         ''
       ) <> all(
         array[
           'left-corner-3',
           'left-wing-3',
           'top-key-3',
           'right-wing-3',
           'right-corner-3',
           'left-elbow',
           'right-elbow',
           'free-throw',
           'left-block',
           'right-block',
           'paint',
           'left-mid',
           'right-mid'
         ]
       )
    then
      raise exception 'Invalid shot zone';
    end if;


    if jsonb_typeof(
         p_payload->'made'
       ) is distinct from 'boolean'
    then
      raise exception 'Shot result required';
    end if;


    insert into public.shot_logs (
      id,
      session_id,
      player_id,
      zone_id,
      made,
      created_at
    )
    values (
      p_id,
      p_session,
      s.player_id,
      p_payload->>'zone_id',
      (p_payload->>'made')::boolean,
      (p_payload->>'recorded_at')::timestamptz
    );


  -- ==========================================================
  -- REVERSAL / CORRECTION
  -- ==========================================================

  elsif kind = 'reverse' then

    reverse_id :=
      (p_payload->>'target')::uuid;


    select *
    into target
    from public.session_commands
    where id = reverse_id
      and session_id = p_session;


    if not found
       or exists (
         select 1
         from public.session_commands
         where reverses = reverse_id
       )
    then
      raise exception
        'Entry cannot be reversed';
    end if;


    if target.payload->>'kind' = 'shot'
    then

      delete from public.shot_logs
      where id = target.id
        and session_id = p_session;


    elsif target.payload->>'kind' = 'stat'
    then

      stat :=
        target.payload->>'key';

      delta :=
        (target.payload->>'delta')::integer;


      value :=
        coalesce(
          (g->>stat)::numeric,
          0
        ) - delta;


      if value < 0 then
        raise exception
          'Reversal would make the total negative';
      end if;


      if stat = 'reb'
         and value <
           coalesce(
             (g->>'oreb')::numeric,
             0
           )
           +
           coalesce(
             (g->>'dreb')::numeric,
             0
           )
      then
        raise exception
          'Reverse the split rebound entry instead';
      end if;


      g :=
        jsonb_set(
          g,
          array[stat],
          to_jsonb(value)
        );


      if stat in ('oreb', 'dreb')
      then

        g :=
          jsonb_set(
            g,
            array['reb'],
            to_jsonb(
              coalesce(
                (g->>'reb')::numeric,
                0
              ) - delta
            )
          );

      end if;


    else

      raise exception
        'Only shot and stat entries can be reversed';

    end if;


  -- ==========================================================
  -- GAME / SESSION CONTEXT
  -- ==========================================================

  elsif kind = 'context' then

    if jsonb_typeof(
         p_payload->'context'
       ) is distinct from 'object'
    then
      raise exception 'Context required';
    end if;


    s.tracker_context :=
      p_payload->'context';


    s.date :=
      coalesce(
        nullif(
          s.tracker_context->>'date',
          ''
        )::date,
        s.date
      );


  -- ==========================================================
  -- COMPLETE TRACKER SESSION
  -- ==========================================================

  elsif kind = 'end' then

    s.tracker_status := 'completed';


  else

    raise exception
      'Unknown entry type';

  end if;


  -- Only this RPC may mutate a versioned session.

  perform set_config(
    'courtiq.command_write',
    'on',
    true
  );


  update public.sessions
  set
    game_stats = g,
    tracker_context = s.tracker_context,
    date = s.date,
    tracker_status = s.tracker_status,
    tracker_version = tracker_version + 1
  where id = p_session
  returning *
  into s;


  perform set_config(
    'courtiq.command_write',
    'off',
    true
  );


  insert into public.session_commands (
    id,
    session_id,
    actor_id,
    version,
    payload,
    reverses
  )
  values (
    p_id,
    p_session,
    auth.uid(),
    s.tracker_version,
    p_payload,
    reverse_id
  );


  return to_jsonb(s);

end
$function$

commit;
