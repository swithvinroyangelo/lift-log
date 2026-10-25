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
