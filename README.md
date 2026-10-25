# Lift Log

A personal workout log: unlimited routines, a live workout screen with a rest timer, history, and backup.
With Supabase keys set, data is saved to your account (see `supabase/README.md`). Without them it is stored in your browser.

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

- **Without Supabase keys your data lives in this browser.** If the browser clears site data, it is gone. With keys it lives in your account. Either way, use Profile, then Download backup, now and then.
- Saving needs a connection when Supabase is on. An unfinished workout is kept on the phone, so logging works with no signal and Finish can be tapped again later.
- Tested in desktop Chromium emulating a phone. Not yet tested on a real iPhone.

## Where things are

- `app/` the screens
- `components/` the building blocks (set table, rest timer, picker)
- `lib/store.ts` picks the data layer: `store-local.ts` (browser) or `store-remote.ts` (Supabase). `supabase/` holds the database setup.
- `lib/workout-math.ts` the rules for volume, previous sets and records
- `app/tokens.css` colours, sizes, spacing (copied from `replica/design/tokens.css`)
