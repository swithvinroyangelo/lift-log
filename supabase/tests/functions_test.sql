-- Run after stub_auth.sql + setup.sql (see supabase/README.md). Prints PASS/FAIL rows.
grant usage on schema public, auth to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant select on auth.users to authenticated;
do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; end $$;
grant usage on schema public, auth to anon;

create temp table results(name text, ok boolean, detail text);
grant all on results to authenticated, anon;

insert into auth.users(id,email) values
 ('aaaaaaaa-0000-0000-0000-000000000001','a@x'),('bbbbbbbb-0000-0000-0000-000000000002','b@x');

set role authenticated;
set app.uid = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  bench uuid := (select id from exercises where name='Bench Press (Dumbbell)');
  pull  uuid := (select id from exercises where name='Pull Up');
  rid uuid := gen_random_uuid(); fid uuid := gen_random_uuid(); wid uuid := gen_random_uuid();
  n int; got text;
begin
  insert into routine_folders(id,name) values (fid,'Block');
  perform save_routine(jsonb_build_object('id',rid,'name','Push','notes','','folderId',fid,'exercises',jsonb_build_array(
    jsonb_build_object('id',gen_random_uuid(),'exerciseId',bench,'restSeconds',120,'notes','n','supersetGroup',null,
      'sets',jsonb_build_array(jsonb_build_object('type','warmup','weightKg',20,'reps',10),jsonb_build_object('type','normal','weightKg',45.5,'reps',12))),
    jsonb_build_object('id',gen_random_uuid(),'exerciseId',pull,'sets',jsonb_build_array(jsonb_build_object('type','normal','weightKg',null,'reps',8))))));
  insert into results select 'save_routine writes 2 exercises + 3 sets', (select count(*) from routine_exercises where routine_id=rid)=2
     and (select count(*) from routine_sets)=3, '';
  insert into results select 'routine keeps folder', (select folder_id from routines where id=rid)=fid, '';
  insert into results select 'set order + values kept', (select string_agg(set_type||':'||coalesce(target_weight_kg::text,'-'),',' order by rs.position)
     from routine_sets rs join routine_exercises re on re.id=rs.routine_exercise_id where re.exercise_id=bench)='warmup:20.00,normal:45.50','';

  -- re-save with one exercise: replaces, does not pile up
  perform save_routine(jsonb_build_object('id',rid,'name','Push v2','exercises',jsonb_build_array(
    jsonb_build_object('exerciseId',bench,'sets',jsonb_build_array(jsonb_build_object('type','normal','weightKg',50,'reps',5))))));
  insert into results select 'resave replaces children', (select count(*) from routine_exercises where routine_id=rid)=1
     and (select count(*) from routine_sets)=1 and (select name from routines where id=rid)='Push v2', '';
  insert into results select 'resave without folderId loose', (select folder_id from routines where id=rid) is null, '';

  -- workout: idempotent
  for n in 1..2 loop
    perform save_workout(jsonb_build_object('id',wid,'routineId',rid,'title','Chest','notes','','startedAt','2026-10-20T10:00:00Z','endedAt','2026-10-20T11:00:00Z',
      'exercises',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'exerciseId',bench,'notes','','supersetGroup',null,
        'sets',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','normal','weightKg',40,'reps',10,'rpe',null,'completed',true),
                                 jsonb_build_object('id',gen_random_uuid(),'type','warmup','weightKg',20,'reps',10,'rpe',8.5,'completed',true))))));
  end loop;
  insert into results select 'save_workout twice = one workout', (select count(*) from workouts)=1 and (select count(*) from workout_exercises)=1
     and (select count(*) from workout_sets)=2, (select count(*) from workout_sets)::text;
  insert into results select 'rpe + completed stored', (select rpe from workout_sets where set_type='warmup')=8.5 and (select bool_and(completed) from workout_sets), '';

  -- stale routine id (routine deleted while the workout was running) must not fail the save
  perform save_workout(jsonb_build_object('id',gen_random_uuid(),'routineId',gen_random_uuid(),'title','Orphan','startedAt','2026-10-21T10:00:00Z','endedAt','2026-10-21T10:30:00Z',
      'exercises',jsonb_build_array(jsonb_build_object('exerciseId',pull,'sets',jsonb_build_array(jsonb_build_object('type','normal','weightKg',null,'reps',8,'completed',true))))));
  insert into results select 'stale routineId saved as null', (select routine_id from workouts where title='Orphan') is null, '';

  -- deleting the routine keeps the workout; deleting the folder keeps nothing dangling
  delete from routines where id=rid;
  insert into results select 'delete routine keeps workout', (select count(*) from workouts where title='Chest')=1
     and (select routine_id from workouts where title='Chest') is null, '';

  -- weight precision: lb->kg value with many decimals is stored rounded to 2dp
  perform save_workout(jsonb_build_object('id',gen_random_uuid(),'title','Prec','startedAt','2026-10-22T10:00:00Z','endedAt','2026-10-22T10:30:00Z',
      'exercises',jsonb_build_array(jsonb_build_object('exerciseId',bench,'sets',jsonb_build_array(jsonb_build_object('type','normal','weightKg',61.23496,'reps',5,'completed',true))))));
  insert into results select 'weight rounded to 2dp', exists(select 1 from workout_sets where weight_kg=61.23), '';

  -- bad data is refused and leaves nothing behind (atomic)
  begin
    perform save_workout(jsonb_build_object('id',gen_random_uuid(),'title','Bad','startedAt','2026-10-23T10:00:00Z','endedAt','2026-10-23T10:30:00Z',
      'exercises',jsonb_build_array(jsonb_build_object('exerciseId',bench,'sets',jsonb_build_array(jsonb_build_object('type','normal','weightKg',10,'reps',5000,'completed',true))))));
    got := 'no error';
  exception when others then got := 'refused'; end;
  insert into results select 'reps 5000 refused, nothing half-saved', got='refused' and not exists(select 1 from workouts where title='Bad'), got;

  -- delete a folder: routine survives loose
  perform save_routine(jsonb_build_object('id',gen_random_uuid(),'name','InFolder','folderId',fid,'exercises','[]'::jsonb));
  delete from routine_folders where id=fid;
  insert into results select 'delete folder keeps routine', (select folder_id from routines where name='InFolder') is null, '';
end $$;

-- user B sees nothing of A and cannot overwrite A's workout
set app.uid = 'bbbbbbbb-0000-0000-0000-000000000002';
do $$
declare wid uuid := (select id from workouts limit 1); got text; bench uuid := (select id from exercises where name='Pull Up');
begin
  insert into results select 'B sees none of A', (select count(*) from workouts)=0 and (select count(*) from routines)=0 and (select count(*) from workout_sets)=0, '';
  insert into results select 'B still sees built-in exercises', (select count(*) from exercises)=60, (select count(*) from exercises)::text;
end $$;
reset role;
set role authenticated;
set app.uid = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ declare w uuid := (select id from workouts where title='Chest'); begin perform set_config('app.victim', w::text, false); end $$;
set app.uid = 'bbbbbbbb-0000-0000-0000-000000000002';
do $$
declare got text; bench uuid := (select id from exercises where name='Pull Up');
begin
  begin
    perform save_workout(jsonb_build_object('id',current_setting('app.victim')::uuid,'title','Hijack','startedAt','2026-10-20T10:00:00Z','endedAt','2026-10-20T11:00:00Z','exercises','[]'::jsonb));
    got := 'no error';
  exception when others then got := 'refused'; end;
  insert into results select 'B cannot overwrite A workout id', got='refused', got;
end $$;
reset role;
select title from workouts where title='Hijack';

-- anonymous (not signed in) cannot call the functions
set role anon;
do $$ declare got text; begin
  begin perform save_routine('{"id":"00000000-0000-0000-0000-000000000009","name":"x"}'::jsonb); got:='no error';
  exception when others then got:='refused'; end;
  insert into results select 'anon cannot save_routine', got='refused', got;
end $$;
reset role;
select case when ok then 'PASS' else 'FAIL' end as r, name, detail from results order by 1 desc, 2;
