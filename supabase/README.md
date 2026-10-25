# Setting up the database (once)

1. In your Supabase project open **SQL Editor > New query**.
2. Paste the whole of `setup.sql` and press **Run**. It creates the tables, the security rules, the save functions and the 60 built-in exercises. Run it once on a fresh project; running it again will fail on "already exists" (harmless, but nothing new is added).
3. **Authentication > Providers > Email**: for a personal app, switch **Confirm email** off (otherwise every sign-up needs a link that points at the wrong address until the site is deployed).
4. Create your account in the app. Then **Authentication > Sign In / Providers**: switch **Allow new users to sign up** off, so nobody else can create accounts on your free database.
5. Local use: copy `.env.example` to `.env.local` and fill in the URL and the publishable key. Vercel: add the same two variables in the project settings.

Never put the `service_role` key or the database password in the app, in git, or in a chat.

## Tests

`setup.sql` is built from `001_schema.sql` + `002_functions.sql` + `003_seed_exercises.sql` (cat them in that order).
`tests/functions_test.sql` checks saving, replacing, idempotency, atomicity and who can see what.
Run it on a throwaway Postgres: load a stub for Supabase's `auth` schema (see `docs/tests/stub_auth.sql`), then `setup.sql`, then the test file. 16 checks, all must print PASS.

## Limits (honest)

- These tests ran on plain Postgres, not on Supabase itself, and the app's network code has not been run against a live project from the workspace it was built in. First sign-in on the real project is the first real test.
- Free plan: 500 MB, the project pauses after a week without activity, and whether it keeps backups is unconfirmed. Use Profile > Download backup regularly.
