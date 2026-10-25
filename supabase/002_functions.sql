-- Atomic saves. A routine or workout is spread over 3 tables; one call here writes all of it or none of it
-- (separate calls from the browser could leave half a workout if the connection drops in between).
-- security invoker: row level security still applies, so you can only ever write your own rows.

create or replace function save_routine(p jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  ex jsonb;
  st jsonb;
  re_id uuid;
  ex_pos integer := 0;
  st_pos integer;
  rid uuid := (p->>'id')::uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  insert into routines (id, user_id, folder_id, name, notes)
  values (rid, auth.uid(), nullif(p->>'folderId', '')::uuid, p->>'name', coalesce(p->>'notes', ''))
  on conflict (id) do update
    set folder_id = excluded.folder_id, name = excluded.name, notes = excluded.notes;
  -- (the on-conflict update runs under RLS too, so another user's routine id cannot be overwritten)

  delete from routine_exercises where routine_id = rid;

  for ex in select * from jsonb_array_elements(coalesce(p->'exercises', '[]'::jsonb)) loop
    re_id := coalesce(nullif(ex->>'id', '')::uuid, gen_random_uuid());
    insert into routine_exercises (id, user_id, routine_id, exercise_id, position, rest_seconds, notes, superset_group)
    values (re_id, auth.uid(), rid, (ex->>'exerciseId')::uuid, ex_pos,
            nullif(ex->>'restSeconds', '')::integer, coalesce(ex->>'notes', ''),
            nullif(ex->>'supersetGroup', '')::integer);
    st_pos := 0;
    for st in select * from jsonb_array_elements(coalesce(ex->'sets', '[]'::jsonb)) loop
      insert into routine_sets (user_id, routine_exercise_id, position, set_type, target_weight_kg, target_reps)
      values (auth.uid(), re_id, st_pos, coalesce(st->>'type', 'normal'),
              nullif(st->>'weightKg', '')::numeric, nullif(st->>'reps', '')::integer);
      st_pos := st_pos + 1;
    end loop;
    ex_pos := ex_pos + 1;
  end loop;
end $$;

create or replace function save_workout(p jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  ex jsonb;
  st jsonb;
  we_id uuid;
  ex_pos integer := 0;
  st_pos integer;
  wid uuid := (p->>'id')::uuid;
  rid uuid := nullif(p->>'routineId', '')::uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  -- the routine may have been deleted since the workout started: keep the workout, forget the link
  if rid is not null and not exists (select 1 from routines where id = rid and user_id = auth.uid()) then
    rid := null;
  end if;

  insert into workouts (id, user_id, routine_id, title, notes, started_at, ended_at)
  values (wid, auth.uid(), rid, p->>'title', coalesce(p->>'notes', ''),
          (p->>'startedAt')::timestamptz, (p->>'endedAt')::timestamptz)
  on conflict (id) do update
    set routine_id = excluded.routine_id, title = excluded.title, notes = excluded.notes,
        started_at = excluded.started_at, ended_at = excluded.ended_at;

  delete from workout_exercises where workout_id = wid;

  for ex in select * from jsonb_array_elements(coalesce(p->'exercises', '[]'::jsonb)) loop
    we_id := coalesce(nullif(ex->>'id', '')::uuid, gen_random_uuid());
    insert into workout_exercises (id, user_id, workout_id, exercise_id, position, notes, superset_group)
    values (we_id, auth.uid(), wid, (ex->>'exerciseId')::uuid, ex_pos, coalesce(ex->>'notes', ''),
            nullif(ex->>'supersetGroup', '')::integer);
    st_pos := 0;
    for st in select * from jsonb_array_elements(coalesce(ex->'sets', '[]'::jsonb)) loop
      insert into workout_sets (id, user_id, workout_exercise_id, position, set_type, weight_kg, reps, rpe, completed)
      values (coalesce(nullif(st->>'id', '')::uuid, gen_random_uuid()), auth.uid(), we_id, st_pos,
              coalesce(st->>'type', 'normal'), nullif(st->>'weightKg', '')::numeric,
              nullif(st->>'reps', '')::integer, nullif(st->>'rpe', '')::numeric,
              coalesce((st->>'completed')::boolean, false));
      st_pos := st_pos + 1;
    end loop;
    ex_pos := ex_pos + 1;
  end loop;
end $$;

-- Only signed-in users may call these (not the anonymous role).
revoke all on function save_routine(jsonb) from public, anon;
revoke all on function save_workout(jsonb) from public, anon;
grant execute on function save_routine(jsonb) to authenticated;
grant execute on function save_workout(jsonb) to authenticated;
