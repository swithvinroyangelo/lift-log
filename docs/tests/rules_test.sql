grant usage on schema public, auth to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant select on auth.users to authenticated;

create temp table results(name text, ok boolean, detail text);
grant all on results to authenticated;

insert into auth.users(id,email) values
 ('aaaaaaaa-0000-0000-0000-000000000001','a@x'),('bbbbbbbb-0000-0000-0000-000000000002','b@x');
insert into results select 'signup trigger creates profiles', count(*)=2, count(*)::text from profiles;
-- built-in exercise seeded as admin
insert into exercises(name,muscle_group) values ('Bench Press','chest'),('Squat','quads');

set role authenticated;
set app.uid = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare i int; n int; rid uuid; reid uuid; ex uuid; w1 uuid := gen_random_uuid(); w2 uuid := gen_random_uuid();
        we1 uuid; we2 uuid; got text; ok boolean;
begin
  -- 1. no caps: 50 routines, 60 custom exercises, 400 workouts
  for i in 1..50 loop insert into routines(name) values ('R'||i); end loop;
  for i in 1..60 loop insert into exercises(user_id,name,muscle_group) values (auth.uid(),'Custom '||i,'other'); end loop;
  for i in 1..400 loop insert into workouts(id,title,started_at,ended_at)
     values (gen_random_uuid(),'W'||i, now()-make_interval(days=>i+10), now()-make_interval(days=>i+10)+interval '1 hour'); end loop;
  select count(*) into n from routines;  insert into results values ('50 routines allowed (free cap is 4)', n=50, n::text);
  select count(*) into n from exercises where user_id=auth.uid(); insert into results values ('60 custom exercises allowed (free cap is 7)', n=60, n::text);
  select count(*) into n from workouts; insert into results values ('400 workouts, some >3 months old', n=400, n::text);

  -- 2. previous_sets returns the most recent EARLIER completed sets
  select id into ex from exercises where name='Bench Press';
  insert into workouts(id,title,started_at,ended_at) values (w1,'old', now()-interval '5 days', now()-interval '5 days'+interval '1 hour');
  insert into workout_exercises(workout_id,exercise_id,position) values (w1,ex,0) returning id into we1;
  insert into workout_sets(workout_exercise_id,position,weight_kg,reps,completed) values (we1,0,60,8,true),(we1,1,60,7,true),(we1,2,60,5,false);
  insert into workouts(id,title,started_at,ended_at) values (w2,'newer', now()-interval '2 days', now()-interval '2 days'+interval '1 hour');
  insert into workout_exercises(workout_id,exercise_id,position) values (w2,ex,0) returning id into we2;
  insert into workout_sets(workout_exercise_id,position,weight_kg,reps,completed) values (we2,0,62.5,8,true);
  select string_agg(weight_kg||'x'||reps, ',' order by set_number) into got from previous_sets(ex, now()-interval '1 day');
  insert into results values ('previous_sets picks latest earlier workout', got='62.50x8', got);
  select string_agg(weight_kg||'x'||reps, ',' order by set_number) into got from previous_sets(ex, now()-interval '3 days');
  insert into results values ('previous_sets skips uncompleted sets', got='60.00x8,60.00x7', got);

  -- 3. duplicate custom exercise name blocked (case-insensitive)
  begin insert into exercises(user_id,name,muscle_group) values (auth.uid(),'custom 1','other'); ok:=false;
  exception when unique_violation then ok:=true; end;
  insert into results values ('duplicate custom exercise name blocked', ok, '');

  -- 4. users cannot edit built-in exercises
  update exercises set name='HACKED' where name='Squat'; get diagnostics n = row_count;
  insert into results values ('cannot rename built-in exercise', n=0, 'rows changed: '||n);
  delete from exercises where name='Squat'; get diagnostics n = row_count;
  insert into results values ('cannot delete built-in exercise', n=0, 'rows deleted: '||n);

  -- 5. exercise with history cannot be deleted
  insert into exercises(user_id,name,muscle_group) values (auth.uid(),'Used','other') returning id into ex;
  insert into workout_exercises(workout_id,exercise_id,position) values (w1,ex,1);
  begin delete from exercises where id=ex; ok:=false; exception when foreign_key_violation then ok:=true; end;
  insert into results values ('exercise with history cannot be deleted', ok, '');

  -- 6. deleting a routine keeps past workouts
  insert into routines(name) values ('temp') returning id into rid;
  insert into workouts(id,routine_id,title,started_at,ended_at) values (gen_random_uuid(),rid,'from temp',now(),now());
  delete from routines where id=rid;
  select count(*) into n from workouts where title='from temp' and routine_id is null;
  insert into results values ('deleting routine keeps its workouts', n=1, n::text);

  -- 7. client-supplied workout id: replay with ON CONFLICT does not duplicate
  insert into workouts(id,title,started_at,ended_at) values (w1,'old',now(),now()) on conflict (id) do nothing;
  select count(*) into n from workouts where id=w1;
  insert into results values ('retry of same workout id is idempotent', n=1, n::text);

  -- keep ids for the other-user test
  perform set_config('t.rid', (select id::text from routines limit 1), false);
  perform set_config('t.w1', w1::text, false);
end $$;

-- 8. user B cannot see or touch A's data
set app.uid = 'bbbbbbbb-0000-0000-0000-000000000002';
do $$
declare n int; ok boolean; rid uuid := current_setting('t.rid')::uuid; w1 uuid := current_setting('t.w1')::uuid;
begin
  select count(*) into n from routines;  insert into results values ('B sees 0 of A routines', n=0, n::text);
  select count(*) into n from workouts;  insert into results values ('B sees 0 of A workouts', n=0, n::text);
  select count(*) into n from exercises; insert into results values ('B sees only 2 built-ins, not A customs', n=2, n::text);
  begin insert into routine_exercises(routine_id,exercise_id,position)
          select rid, id, 0 from exercises limit 1; ok:=false;
  exception when others then ok:=true; end;
  insert into results values ('B cannot attach exercise to A routine', ok, '');
  begin insert into workout_exercises(workout_id,exercise_id,position)
          select w1, id, 0 from exercises limit 1; ok:=false;
  exception when others then ok:=true; end;
  insert into results values ('B cannot add exercise to A workout', ok, '');
  begin insert into routines(user_id,name) values ('aaaaaaaa-0000-0000-0000-000000000001','spoof'); ok:=false;
  exception when others then ok:=true; end;
  insert into results values ('B cannot insert row owned by A', ok, '');
  update routines set name='x' where id=rid; get diagnostics n = row_count;
  insert into results values ('B cannot update A routine', n=0, n::text);
  select count(*) into n from previous_sets((select id from exercises where name='Bench Press'), now());
  insert into results values ('B previous_sets does not leak A history', n=0, n::text);
end $$;

reset role;
select case when ok then 'PASS' else 'FAIL' end as r, name, detail from results order by ok, name;
