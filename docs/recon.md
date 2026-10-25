# Recon map: Hevy (iOS and Android, rebuilt as a web app)

Scope: everything in Hevy that can legally and practically be rebuilt, minus the skip rows in `features.csv`
For: the owner's personal use, as a learning project. Everything unlocked, no routine cap.
Date: 2026-10-21

**Evidence limits.** Built from public text only: the App Store listing, the Hevy help center article on Pro, and the Hevy feature pages. No screenshots were reviewed, the help center index did not load, and the public API docs returned only a title. So the screen list and data model below are inferred from feature descriptions. Screens are `medium` confidence, entities are `medium` or `guess`. Redo this against real screenshots before the design step.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | App Store listing | https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350 | v3.2.1, feature list, version history, Pro pricing (two conflicting monthly prices shown) |
| 2 | Feature pages | https://www.hevyapp.com/features/best-way-to-track-workouts/ | the most complete feature list, links to about 50 sub-pages |
| 3 | Help center home | https://help.hevyapp.com/hc/en-us | category index did not load, so articles were not read |
| 4 | Help article: Hevy Pro | https://help.hevyapp.com/hc/en-us/articles/35119778922263-Hevy-Pro-Subscription-How-to-get-Pro-and-What-Does-It-Include | free plan limits: 4 routines, 7 custom exercises, 3 months history |
| 5 | Public API docs | https://api.hevyapp.com/docs/ | only the title loaded, so nothing was used |

## Core loop

Pick a routine, log each set against what you lifted last time, and watch the numbers go up over weeks.

## Screens (inferred)

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Sign up / log in | first launch | account for sync | email form | not seen |
| S02 | Workout tab (home) | tab bar | start a workout, see My Routines | routine cards, folders, Start Empty Workout button | empty, filled |
| S03 | Routine editor | S02 > New Routine / edit | build a routine | exercise rows, set rows, rest timer per exercise, notes | empty, filled |
| S04 | Live workout | S02 > Start Routine | log sets in the gym | set table, previous values, complete checkbox, rest timer, add exercise, finish | in progress, finished |
| S05 | Exercise picker | S03 or S04 > Add Exercise | choose or create an exercise | search, muscle filter, custom exercise form | empty search |
| S06 | Workout summary | after finishing | review and save | totals, PRs, save as routine | filled |
| S07 | Profile / history | tab bar | list of past workouts | workout cards, calendar link | empty, filled |
| S08 | Workout detail / edit | S07 > card | view, edit, delete, copy | set table, notes | filled |
| S09 | Calendar | S07 > Calendar | see which days you trained | month grid, circled days | empty, filled |
| S10 | Exercise detail | S05 or S04 > exercise | per-exercise graph, PRs, notes | chart, record list, notes | no data, filled |
| S11 | Progress / stats | tab bar | muscle group sets per week, distribution | charts | no data, filled |
| S12 | Body metrics | profile > measurements | log weight and measurements | form, chart | empty, filled |
| S13 | Progress photos | profile > photos | photo timeline | grid, upload | empty, filled |
| S14 | Settings | profile > settings | units, rest timer defaults, language | toggles | default |
| S15 | Share folder or routine | S02 > share | link to a routine | link sheet | filled |
| S16 | Monthly report / year in review | profile | recap | summary cards | filled |

## Flows

```
F01 Do a workout from a routine
    S02 -> S04 -> S05 (add exercise, optional) -> S06 -> S07
    happy path clicks: about 4 to start and finish, plus 3 taps per set
    edge: phone locks mid-workout, offline, app closed with workout in progress, adding a set mid-exercise

F02 Build a routine
    S02 -> S03 -> S05 -> S03 -> save
    edge: duplicate exercise, empty routine, reorder, delete exercise with sets

F03 Turn a finished workout into a routine
    S04 -> S06 -> save as routine -> S03

F04 Review progress on one lift
    S07 -> S08 -> S10

F05 Fix a mistake after the workout
    S07 -> S08 -> edit -> save
    edge: editing changes PRs and "previous values" for later workouts

F06 Log body weight
    S07 -> S12
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Set row | normal, warm-up, drop, failure | empty, filled, completed | S03, S04, S08 |
| Exercise block | normal, superset group | collapsed, expanded | S03, S04, S08 |
| Rest timer | per exercise, floating countdown | idle, running, done | S03, S04 |
| Routine card | in folder, loose | default | S02 |
| Workout card | with PR badge | default | S07 |
| Chart | line, bar | empty, filled | S10, S11, S12 |
| Calendar grid | month | empty day, trained day | S09 |
| Search list | with muscle filter | empty, results | S05 |
| Bottom tab bar | 3 to 5 tabs | selected | all |
| Button, input, modal, toast | standard | standard | all |

## Inferred data model

```
User         id, email, units (kg|lb), default_rest_seconds
             evidence: S01, S14, feature pages   confidence: medium

Exercise     id, user_id (null for built-in), name, muscle_group, equipment, notes
             evidence: S05, free plan cap of 7 custom exercises [src 4]   confidence: medium

RoutineFolder  id, user_id, name, position
             evidence: "Create Folders and Gym Routines" [src 2]   confidence: medium

Routine      id, user_id, folder_id, name, notes, position
             evidence: S02, S03, free plan cap of 4 [src 4]   confidence: high

RoutineExercise  id, routine_id, exercise_id, position, rest_seconds, notes, superset_group
             evidence: S03, superset and rest timer features   confidence: medium

RoutineSet   id, routine_exercise_id, position, set_type, target_weight, target_reps
             evidence: "Exercise Programming Options" [src 2]   confidence: guess

Workout      id, user_id, routine_id (nullable), title, started_at, ended_at, notes
             evidence: S04, S06, S07   confidence: high

WorkoutExercise  id, workout_id, exercise_id, position, notes, superset_group
             evidence: S08   confidence: medium

WorkoutSet   id, workout_exercise_id, position, set_type, weight, reps, rpe, completed
             evidence: [src 1] logging of weight, reps, RPE, set types   confidence: high

BodyMeasurement  id, user_id, date, kind (weight|waist|...), value
             evidence: S12   confidence: medium

ProgressPhoto  id, user_id, date, file_url
             evidence: S13   confidence: medium
```

Relationships: User 1-n Routine, RoutineFolder 1-n Routine, Routine 1-n RoutineExercise 1-n RoutineSet, User 1-n Workout, Workout 1-n WorkoutExercise 1-n WorkoutSet, Exercise 1-n (RoutineExercise, WorkoutExercise).

Open question for architect: a workout copies its exercises and sets at start time, so editing a routine later must not rewrite old workouts.

## Feature matrix

See `features.csv`. Must: 23, should: 20, could: 16, skip: 14.

## Update 2026-10-22: what 4 screenshots of the real app changed

Screenshots of Home, the Workout tab, Profile and Calendar (the owner's own account) are in `screens/`. They hold a photo of another person's avatar (an account the owner follows), so do not share that folder.

- **Confirmed:** the free plan cap is visible on screen ("My Routines (4)"), and a yellow PRO badge sits in the Workout tab header.
- **Navigation is 3 tabs**, not 3 to 5: Home, Workout, Profile.
- **Home is the social feed.** In our app it becomes a plain list of your own recent workouts (S07 and Home merge). The follow, like and comment parts stay skipped.
- **Profile is a dashboard:** a weekly chart with Duration, Volume and Reps toggles and a date range, four tiles (Statistics, Exercises, Measures, Calendar), then the workout list.
- **Calendar:** shows a week streak and a rest-day count, and each trained day is a circle with the routine name underneath (PUSH, PULL, LEG, UB).
- **Workout cards** show Time, Volume and a Records count, plus the first three exercises and "See N more".
- **Added to the matrix:** 5 buildable rows and 1 skip row (search and notifications, which only exist for the social network).
- **Still missing:** the routine editor (S03) and the workout detail / edit screen (S08).

## Out of scope (cannot or should not be cloned)

- Follow, feed, likes, comments, discovery and leaderboards: the network and its users, which a single-user app does not have.
- The program library and exercise videos: licensed content owned by Hevy. We write our own exercise list, with text instructions only.
- Apple Watch, WearOS, HealthKit, Live Activity, widgets and native apps: they need native code, paid developer accounts, and hardware.
- Hevy Coach: a separate B2B product.
- Pro subscription and payments: not needed for a personal build.

## Size

Screens 16, flows 6, entities 11. Hard parts: live workout screen state that survives a phone lock or closed tab, offline logging with sync, previous-performance lookup and PR detection (and recalculating them after edits), exercise content written from scratch, and an optional AI-generated program.

- **Everything above except skips: L**, roughly a quarter of part-time work.
- **With the skipped items it would be XL**, which is why they are out.
- **Suggested phases:**
  - Phase 1, M: all 17 must-haves, which gives you unlimited routines.
  - Phase 2: the should-haves.
  - Phase 3: the could-haves, in order of value to you.

Next step: `/replica-architect`.

## Update 2026-10-22 (second batch): live workout, rest timer, exercise menu, picker

Screenshots in `screens/`: `ref-live-idle`, `ref-live-done`, `ref-exercise-menu`, `ref-picker`. They contain no other person's data.

- **S04 live workout is now confirmed.** Header (collapse chevron, "Log Workout", rest-timer shortcut, Finish), a stats strip (Duration clock, Volume, Sets, muscle diagram), the routine note, then one block per exercise: name, notes, rest-timer line, set table (SET, PREVIOUS, KG, REPS, check), Add Set.
- **Completing a set** turns its row green and starts a rest timer in a bottom panel (minus 15, countdown, plus 15, Skip).
- **Set types are per row and order is free.** The reference shows 1, 2, 3, then a warm-up "W", then 4. Working sets are numbered; warm-ups show "W". The schema already allows this (`position` and `set_type`). The app must compute the displayed number by skipping warm-ups.
- **Exercise menu** (bottom sheet): Reorder, Replace, Add To Superset, Remove.
- **S05 picker:** Cancel, title, Create, search, All Equipment and All Muscles filters, Suggested and Recent sections, and a stats shortcut on each row.
- **Schema check:** everything seen is supported (per-exercise rest and notes, warm-up type, routine notes). The rest duration lives only on `routine_exercises`, which is fine because it is used live. One thing is not stored anywhere: whether a workout has been collapsed or is in progress. That is the browser draft already planned in `architecture.md`.
- **Added to the matrix:** 12 rows (above).
