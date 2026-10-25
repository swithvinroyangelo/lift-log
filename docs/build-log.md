# Build log

Stack as planned: Next.js + TypeScript + Tailwind, design tokens from `design/`. This slice stores data in the browser through an async data layer (`lib/store.ts`) shaped like the database in `schema.sql`, so the real Supabase layer replaces one file later.

| screen | date | status | what is missing | what was harder than expected |
| --- | --- | --- | --- | --- |
| S02 Workout tab | 2026-10-24 | done | folders; "Explore" (skipped: it is Hevy's content) | none |
| S03 Routine editor | 2026-10-24 | done | built from the live workout screenshots, not from a real screenshot of the original editor | none |
| S04 Live workout | 2026-10-24 | done | RPE input; shared rest timer for supersets; the yellow warning icon and header alarm icon (meaning unknown, not copied) | the unfinished workout must survive a closed tab, so state saves after every change; the rest timer counts to an end time so a locked phone cannot make it drift |
| S05 Exercise picker | 2026-10-24 | done | "Suggested" (only Recent) | none |
| S06 Finish / summary | 2026-10-24 | partial | no separate summary screen; finishing goes straight to the saved workout page | none |
| S07 History / Home | 2026-10-24 | done | none | none |
| S08 Workout detail | 2026-10-24 | partial | read-only: you cannot edit a past workout yet (a must-have) | records are recomputed on every read so edits will not leave stale counts |
| S14 Settings (on Profile) | 2026-10-24 | done | language | none |
| Backup and restore | 2026-10-24 | done | not in the original; added because browser storage can be cleared | n/a |
| S01 Sign-in, S09 Calendar, S10 Exercise detail, S11 Stats, S12 Measures, S13 Photos, S15 Share, S16 Reports | | not started | all | |

## Decisions that are mine, not copied (unverified against the original)

- Warm-up sets do not count toward volume or the set count.
- A "record" is a workout where an exercise's heaviest completed set beats every earlier workout's heaviest set. The first time you do an exercise is not a record.
- The tab bar is hidden during a live workout.
- The exercise name on the live screen is not tappable yet (the original's opens a stats page, which does not exist here).
- Bodyweight movements logged with 0 kg add nothing to volume.
- 62 built-in exercises, written fresh (names only). The original's illustrations and videos are not used.

## Checks run

- 20 logic tests (volume, set labels, previous sets, records, units, clocks): pass.
- 7 browser tests in Chromium (the last two cover routine folders and editing a past workout) at phone width, plus a 1440 px width check: pass. They cover: unlimited routines (6 vs the original's free cap of 4), start a workout, reload mid-workout with nothing lost, the rest timer surviving a reload, finishing with unfinished sets, history, "Previous" values on the next workout, backup and restore, the exercise menu (move, replace, remove, superset), custom exercises, warm-up labels, and lb storage.
- Type-check clean. No raw colours in components (only the `themeColor` meta tag, which needs a literal and equals the background token).
- Bug found by the tests and fixed: the set-number buttons had their button role overridden, so assistive tools could not see them as buttons.

- Edit-past-workout drops blank sets and empty exercises on save, and marks the remaining sets completed. My decision, not verified against the original.

## Not checked

- iPhone Safari. Everything above ran in desktop Chromium emulating a phone.
- Installing to the home screen, and whether the install keeps the data. The manifest and icons exist; nothing has proved it on a real phone.
- Real offline use (airplane mode) and long-lock behaviour of the rest timer on a real phone.
- Screen reader testing by a person. Labels and roles are in place; no one has listened to it.
