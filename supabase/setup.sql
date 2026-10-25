-- Schema for a personal workout tracker (core features of a gym logging app).
-- Target: Postgres 15+ on Supabase. Row level security is ON for every table.
-- Rules this file enforces so the app code cannot get them wrong:
--   * no caps on routines, folders, custom exercises or history
--   * a user can only ever link their own rows together (composite foreign keys)
--   * weights are stored in kg, always; the app converts for display
--   * deleting an exercise that has history is blocked; archive it instead

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- helpers
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  units text not null default 'kg' check (units in ('kg', 'lb')),
  timezone text not null default 'UTC',
  default_rest_seconds integer not null default 90
    check (default_rest_seconds between 0 and 1800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- exercises
-- user_id null = built-in exercise (seeded by you, read-only to users).
create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  muscle_group text not null check (muscle_group in (
    'chest','back','shoulders','biceps','triceps','forearms','abs',
    'quads','hamstrings','glutes','calves','full_body','cardio','other')),
  equipment text not null default 'other' check (equipment in (
    'barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','other')),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- a user cannot have two active custom exercises with the same name
create unique index exercises_user_name_uq
  on exercises (user_id, lower(name)) where user_id is not null and archived_at is null;
create unique index exercises_builtin_name_uq
  on exercises (lower(name)) where user_id is null;
create index exercises_user_idx on exercises (user_id);

-- ---------------------------------------------------------------- routines
create table routine_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index routine_folders_user_idx on routine_folders (user_id, position);

create table routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  folder_id uuid,
  name text not null check (length(trim(name)) > 0),
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- deleting a folder keeps its routines (they become loose); folder_id only is nulled
  foreign key (folder_id, user_id) references routine_folders (id, user_id)
    on delete set null (folder_id)
);
create index routines_user_idx on routines (user_id, folder_id, position);

create table routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  routine_id uuid not null,
  exercise_id uuid not null references exercises(id) on delete restrict,
  position integer not null,
  rest_seconds integer check (rest_seconds is null or rest_seconds between 0 and 1800),
  notes text,
  superset_group integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (routine_id, user_id) references routines (id, user_id) on delete cascade
);
create index routine_exercises_routine_idx on routine_exercises (routine_id, position);
create index routine_exercises_exercise_idx on routine_exercises (exercise_id);

create table routine_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  routine_exercise_id uuid not null,
  position integer not null,
  set_type text not null default 'normal'
    check (set_type in ('normal','warmup','drop','failure')),
  target_weight_kg numeric(7,2) check (target_weight_kg is null or target_weight_kg >= 0),
  target_reps integer check (target_reps is null or target_reps between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (routine_exercise_id, user_id)
    references routine_exercises (id, user_id) on delete cascade
);
create index routine_sets_re_idx on routine_sets (routine_exercise_id, position);

-- ---------------------------------------------------------------- workouts
-- id is generated by the CLIENT so a retry after a bad connection cannot save twice.
create table workouts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  routine_id uuid,
  title text not null check (length(trim(title)) > 0),
  notes text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_time_order check (ended_at >= started_at),
  unique (id, user_id),
  -- deleting a routine must NOT touch past workouts
  foreign key (routine_id, user_id) references routines (id, user_id)
    on delete set null (routine_id)
);
create index workouts_user_started_idx on workouts (user_id, started_at desc);

create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  workout_id uuid not null,
  exercise_id uuid not null references exercises(id) on delete restrict,
  position integer not null,
  notes text,
  superset_group integer,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (workout_id, user_id) references workouts (id, user_id) on delete cascade
);
create index workout_exercises_workout_idx on workout_exercises (workout_id, position);
create index workout_exercises_exercise_idx on workout_exercises (exercise_id);

create table workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  workout_exercise_id uuid not null,
  position integer not null,
  set_type text not null default 'normal'
    check (set_type in ('normal','warmup','drop','failure')),
  weight_kg numeric(7,2) check (weight_kg is null or weight_kg >= 0),
  reps integer check (reps is null or reps between 0 and 1000),
  rpe numeric(3,1) check (rpe is null or rpe between 1 and 10),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (workout_exercise_id, user_id)
    references workout_exercises (id, user_id) on delete cascade
);
create index workout_sets_we_idx on workout_sets (workout_exercise_id, position);

-- ---------------------------------------------------------------- body + photos
create table body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  measured_on date not null,
  kind text not null check (kind in (
    'weight','body_fat','neck','shoulders','chest','waist','hips',
    'left_arm','right_arm','left_thigh','right_thigh','left_calf','right_calf')),
  value numeric(7,2) not null check (value > 0),
  created_at timestamptz not null default now(),
  -- one value per kind per day; logging again the same day updates it
  unique (user_id, kind, measured_on)
);
create index body_measurements_idx on body_measurements (user_id, kind, measured_on desc);

-- Phase 3 only. Files live in Supabase Storage; this table stores the path.
create table progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  taken_on date not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index progress_photos_idx on progress_photos (user_id, taken_on desc);

-- ---------------------------------------------------------------- triggers
create trigger t_profiles_upd before update on profiles
  for each row execute function set_updated_at();
create trigger t_exercises_upd before update on exercises
  for each row execute function set_updated_at();
create trigger t_folders_upd before update on routine_folders
  for each row execute function set_updated_at();
create trigger t_routines_upd before update on routines
  for each row execute function set_updated_at();
create trigger t_routine_ex_upd before update on routine_exercises
  for each row execute function set_updated_at();
create trigger t_routine_sets_upd before update on routine_sets
  for each row execute function set_updated_at();
create trigger t_workouts_upd before update on workouts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- row level security
-- Every table: you see and change only your own rows. Built-in exercises are
-- readable by everyone signed in and writable by no one (seed them as admin).
alter table profiles          enable row level security;
alter table exercises         enable row level security;
alter table routine_folders   enable row level security;
alter table routines          enable row level security;
alter table routine_exercises enable row level security;
alter table routine_sets      enable row level security;
alter table workouts          enable row level security;
alter table workout_exercises enable row level security;
alter table workout_sets      enable row level security;
alter table body_measurements enable row level security;
alter table progress_photos   enable row level security;

create policy profiles_own on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy exercises_read on exercises
  for select using (user_id is null or user_id = auth.uid());
create policy exercises_write on exercises
  for insert with check (user_id = auth.uid());
create policy exercises_update on exercises
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy exercises_delete on exercises
  for delete using (user_id = auth.uid());

create policy routine_folders_own   on routine_folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy routines_own          on routines
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy routine_exercises_own on routine_exercises
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy routine_sets_own      on routine_sets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy workouts_own          on workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy workout_exercises_own on workout_exercises
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy workout_sets_own      on workout_sets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy body_measurements_own on body_measurements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy progress_photos_own   on progress_photos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- previous performance
-- For each exercise: the sets from the most recent earlier workout that included it.
-- Used by the live workout screen ("last time: 60 kg x 8").
create or replace function previous_sets(p_exercise_id uuid, p_before timestamptz default now())
returns table (set_number integer, set_type text, weight_kg numeric, reps integer, rpe numeric)
language sql stable security invoker as $$
  select s."position", s.set_type, s.weight_kg, s.reps, s.rpe
  from workout_sets s
  join workout_exercises we on we.id = s.workout_exercise_id
  where we.id = (
    select we2.id
    from workout_exercises we2
    join workouts w on w.id = we2.workout_id
    where we2.exercise_id = p_exercise_id
      and w.user_id = auth.uid()
      and w.started_at < p_before
      and exists (select 1 from workout_sets s2
                  where s2.workout_exercise_id = we2.id and s2.completed)
    order by w.started_at desc
    limit 1
  )
  and s.completed
  order by s.position;
$$;

-- ---------------------------------------------------------------- signup hook
-- Without this, a new user has no profiles row and every insert fails its foreign key.
-- security definer: runs as the table owner because the new user has no rights yet.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
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
-- Built-in exercises (user_id null = visible to everyone, editable by no one).
-- Ids match lib/seed-exercises.ts. Safe to run again.
insert into exercises (id, name, muscle_group, equipment) values
  ('e952ede4-5fce-539a-b601-d743feac3b9b', 'Bench Press (Barbell)', 'chest', 'barbell'),
  ('99e0cf8c-1591-5a31-a7ea-27cab54af833', 'Bench Press (Dumbbell)', 'chest', 'dumbbell'),
  ('f03854cf-fe09-5766-9075-34c360719def', 'Incline Bench Press (Barbell)', 'chest', 'barbell'),
  ('f8d3fd4d-9333-564e-8fbf-8c528953329c', 'Incline Bench Press (Dumbbell)', 'chest', 'dumbbell'),
  ('d6abe886-b1f8-5001-ad92-0353d88afec8', 'Incline Chest Press (Machine)', 'chest', 'machine'),
  ('05ca0faa-55cd-5186-8d40-4e0459fb0d39', 'Chest Press (Machine)', 'chest', 'machine'),
  ('7fdabc16-a27f-52f4-9c45-6e1a13984bad', 'Chest Fly (Machine)', 'chest', 'machine'),
  ('b4fe3c87-ac46-55f0-ae2a-2984b17cec74', 'Cable Crossover', 'chest', 'cable'),
  ('1aef3ff7-e3a4-5f23-bcf3-971c8c1c33e5', 'Push Up', 'chest', 'bodyweight'),
  ('55e529c7-afac-5d5a-95ab-983cb9d51c45', 'Dip', 'triceps', 'bodyweight'),
  ('91090a4b-7685-5a10-85a0-8d65633999cc', 'Pull Up', 'back', 'bodyweight'),
  ('69bdcc27-b37d-5c34-bae4-761130fb82b0', 'Pull Up (Assisted)', 'back', 'machine'),
  ('86233f8d-00f5-5f97-b55f-a5761e5d7f93', 'Chin Up', 'back', 'bodyweight'),
  ('426702ec-06cc-5e53-94e5-5ebcf64ce9f8', 'Lat Pulldown (Cable)', 'back', 'cable'),
  ('0116a7f2-a1d8-5dc7-962a-a54978cb84b8', 'Seated Cable Row', 'back', 'cable'),
  ('12ae2ad2-8295-5df4-bb47-e5b0191455c1', 'Single Arm Cable Row', 'back', 'cable'),
  ('89d5509c-9e86-5eb5-bf24-d1150aca0934', 'Bent Over Row (Barbell)', 'back', 'barbell'),
  ('7413e5ae-042a-5da8-9fa0-cc823f56e24a', 'One Arm Row (Dumbbell)', 'back', 'dumbbell'),
  ('663cdf9b-8e72-5300-b86f-4588ec30e1ba', 'T Bar Row', 'back', 'barbell'),
  ('8b624160-707b-5573-92ab-c6d65c3584b4', 'Deadlift (Barbell)', 'back', 'barbell'),
  ('0602aa40-5d16-50f7-ba7f-d7da978b4037', 'Overhead Press (Barbell)', 'shoulders', 'barbell'),
  ('be8b2277-66f9-559d-8588-dadae1c2349c', 'Shoulder Press (Dumbbell)', 'shoulders', 'dumbbell'),
  ('4cbd44aa-ad4d-510d-9472-0ab4d2b410a4', 'Shoulder Press (Machine)', 'shoulders', 'machine'),
  ('ea4fce1d-c141-56f5-9de2-85e474f5e1e8', 'Lateral Raise (Dumbbell)', 'shoulders', 'dumbbell'),
  ('2ad639f7-398d-50ef-a4a8-66b4250e2c96', 'Lateral Raise (Cable)', 'shoulders', 'cable'),
  ('7e85ba2d-2df6-543e-afa1-100acc07fcf9', 'Rear Delt Fly (Machine)', 'shoulders', 'machine'),
  ('185d38b5-6602-5ccc-97d9-95f5b2cfd720', 'Face Pull (Cable)', 'shoulders', 'cable'),
  ('a3433c23-d281-523c-9cbc-1b40cfa69535', 'Shrug (Dumbbell)', 'shoulders', 'dumbbell'),
  ('8c8e58d8-e15c-5670-b256-d6c11c663506', 'Biceps Curl (Barbell)', 'biceps', 'barbell'),
  ('d74c9bf8-70d9-5862-9e37-0e8d0804c330', 'Biceps Curl (Dumbbell)', 'biceps', 'dumbbell'),
  ('b93726a8-ce06-508f-848d-5ff5b1eb0b91', 'Biceps Curl (Cable)', 'biceps', 'cable'),
  ('1e87bfa0-93f7-50e0-972c-f55c02075b59', 'Hammer Curl (Dumbbell)', 'biceps', 'dumbbell'),
  ('b7534e78-e4ba-55a5-8fda-8e7122894083', 'Preacher Curl (Machine)', 'biceps', 'machine'),
  ('9a6084b3-1c79-5ebd-8eef-847060a37f6a', 'Triceps Pushdown (Cable)', 'triceps', 'cable'),
  ('c9e95a0c-6cda-5d28-8b46-31e51ab3a917', 'Overhead Triceps Extension (Cable)', 'triceps', 'cable'),
  ('fb56eb3c-86e9-521c-bfc9-56753a465248', 'Skull Crusher (Barbell)', 'triceps', 'barbell'),
  ('3346f0a1-1f24-5fd9-aba4-5b064af0f5a9', 'Close Grip Bench Press (Barbell)', 'triceps', 'barbell'),
  ('a4f93ac2-ac2e-52e3-a445-cf38dd7f65a1', 'Wrist Curl (Dumbbell)', 'forearms', 'dumbbell'),
  ('53f9d494-f34f-5929-8cb4-c64daeae7c50', 'Crunch', 'abs', 'bodyweight'),
  ('83013948-0033-5171-83a8-e6d947321d04', 'Plank', 'abs', 'bodyweight'),
  ('a348e7de-ad74-58ec-995a-d24f65cd7d89', 'Hanging Leg Raise', 'abs', 'bodyweight'),
  ('3fb78460-d748-59e0-afdf-773962345680', 'Cable Crunch', 'abs', 'cable'),
  ('daf25500-beb0-53db-8e48-d86713fba88e', 'Squat (Barbell)', 'quads', 'barbell'),
  ('ab84da76-c4f7-5768-a530-61f174defa10', 'Squat (Smith Machine)', 'quads', 'machine'),
  ('f45db8d8-c77b-5363-90fd-e2b6e644a747', 'Leg Press (Machine)', 'quads', 'machine'),
  ('f015ae16-c8d4-588e-8128-604214b17ca8', 'Leg Extension (Machine)', 'quads', 'machine'),
  ('3b652eb2-3ea1-5251-ab6e-5403c0f7d6a8', 'Bulgarian Split Squat (Dumbbell)', 'quads', 'dumbbell'),
  ('de259e16-b85a-5754-a4c3-9ee8b123a09c', 'Lunge (Dumbbell)', 'quads', 'dumbbell'),
  ('b2e75c58-88e8-5194-bb7a-17815b39cf4b', 'Romanian Deadlift (Barbell)', 'hamstrings', 'barbell'),
  ('e97fdf77-2932-5bd9-93e3-dc2bbb92b01a', 'Romanian Deadlift (Dumbbell)', 'hamstrings', 'dumbbell'),
  ('8a13f0ac-ebc7-5ce4-ab39-6209d700474e', 'Lying Leg Curl (Machine)', 'hamstrings', 'machine'),
  ('598b4e59-e06a-5a02-a7f4-cc99814d670a', 'Seated Leg Curl (Machine)', 'hamstrings', 'machine'),
  ('8708608e-ef67-5098-8ba0-8d4aac53b782', 'Hip Thrust (Barbell)', 'glutes', 'barbell'),
  ('6c7a3ca9-6153-5fe9-8769-379866e07c6b', 'Glute Kickback (Cable)', 'glutes', 'cable'),
  ('9ab9caf4-4f41-56fe-9ac6-394a9cae7ad8', 'Standing Calf Raise (Machine)', 'calves', 'machine'),
  ('fe518a11-5647-5c71-a37a-a0f56b8ffd94', 'Seated Calf Raise (Machine)', 'calves', 'machine'),
  ('5455f02a-fd20-5790-befc-6ab6b4f91157', 'Kettlebell Swing', 'full_body', 'kettlebell'),
  ('a467199b-bd35-5b94-adf1-c99b6670d439', 'Treadmill Run', 'cardio', 'machine'),
  ('c3d9a097-37d3-5e1c-8235-d167c91feec7', 'Cycling', 'cardio', 'machine'),
  ('1dbcba1c-742d-5846-b6b9-30778328a030', 'Rowing Machine', 'cardio', 'machine')
on conflict (id) do nothing;
