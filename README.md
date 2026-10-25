# Lift Log

A personal workout log: unlimited routines, a live workout screen with a rest timer, history, and backup.
Data is stored in your browser for now (see "Limits").

## Run it on your computer

You need Node.js 20 or newer.

```
npm install
npm run dev
```

Open http://localhost:3000 in your browser. On a phone, use your computer's address on the same Wi-Fi.

## Run the checks

```
npm test          # logic tests
npm run e2e       # browser tests (needs a Chromium browser; set CHROMIUM_PATH to its location)
```

## Limits (read these)

- **Your data lives in this browser.** If the browser clears site data, it is gone. Use Profile, then Download backup, now and then.
- No accounts and no sync between devices yet. That is the next step (Supabase).
- Tested in desktop Chromium emulating a phone. Not yet tested on a real iPhone.

## Where things are

- `app/` the screens
- `components/` the building blocks (set table, rest timer, picker)
- `lib/store.ts` the data layer. Replacing this one file with the database version is the plan.
- `lib/workout-math.ts` the rules for volume, previous sets and records
- `app/tokens.css` colours, sizes, spacing (copied from `replica/design/tokens.css`)
