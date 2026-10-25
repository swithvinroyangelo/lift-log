# What was measured, and how sure it is

Source: 4 screenshots of the owner's own account (`screens/ref-*.png`, 1170 x 2532 px, so 3 px = 1 pt). Colours were sampled from pixels. Sizes come from pixel scans. The screenshots are reference only and are never shipped.

**First measurement pass was wrong and was redone.** I picked sample points from a smaller preview of the images (924 px wide) but sampled the real 1170 px files, so the first colours were garbage (for example the accent read as white). Fixed by rescaling the coordinates. Everything below is from the corrected run.

## Colours (measured, then mapped to roles)

| role | measured in reference | used in tokens | note |
| --- | --- | --- | --- |
| bg | `#000000` | `#000000` | |
| surface (cards, bars, tab bar) | `#1c1c1e` | `#1c1c1e` | |
| divider / raised | `#2c2c2e` | `#2c2c2e` | |
| text-muted | `#83898f` | `#8e949b` | **changed**: the measured value was 4.5:1 or lower on the raised surface, so it was brightened slightly |
| accent | `#008cff` | `#a78bfa` (violet; changed from green, see below) | **deliberately different**: the signature blue is the original's brand colour. Neutral placeholder until `replica-brand` |
| record medal | `#f7d000` | `#f7d000` | generic gold |
| PRO badge | `#ffde00` | not used | no Pro tier in this app |
| notification dot | `#e34b37` | danger `#ff6b5e` | |
| streak flame | `#ff5c21` | `#ff7a3d` | |

Greys really used: 3 (`#000000`, `#1c1c1e`, `#2c2c2e`) plus one muted text grey.

## Geometry (pt, measured)

- Screen side margin 16. Card inner padding 16. Gap between cards 16 to 17.
- "Start Empty Workout" bar and the New Routine / Explore buttons: 48 tall, corner radius about 8.
- Routine card: about 147 tall with its button, radius about 10.
- Primary button ("Start Routine"): 40 tall, radius about 8, full card width.
- Tab bar: about 49 tall, three tabs (Home, Workout, Profile), plus the phone's home-indicator area.

## Type (estimated, plus or minus 1 to 2 pt)

Raw text heights read small, so sizes were cross-checked against text widths (for example "Start Routine" is 77 pt wide, which matches about 14 pt). Estimates: page title about 20 bold, section and card titles about 16 semibold, body and exercise lines about 14, stat labels about 10 to 12 muted, tab labels and calendar day tags about 10. Font is the phone's system font (the Apple system face). On the web we use `system-ui`, which renders that same face on Apple devices and a similar one elsewhere.

## Not measured, because it isn't in these screenshots

- The routine editor (S03) and the workout detail / edit screen (S08). The set table, exercise header and picker from the live workout are probably reused there, but that is a guess.
- Input fields, modals, toasts, empty states and error states. Their styling here is the skill's default, not a measurement.
- Motion.

## Second batch: live workout, rest timer, exercise menu, picker

Four more screenshots (`screens/ref-live-idle.png`, `ref-live-done.png`, `ref-exercise-menu.png`, `ref-picker.png`), same 1170 x 2532 size. Measured:

| thing | measured | used |
| --- | --- | --- |
| set row backgrounds | alternate `#000000` and `#1c1c1e`, 49 pt tall | bg and surface, 48 |
| completed row fill | `#2c6111` | `success-surface` `#1f4d2e` (own colour) |
| completed check button | `#56bd23` | success `#4ade80` |
| idle check button | `#83898f` | text-muted, 3.06:1 against the white icon (passes the 3:1 floor for icons) |
| warm-up "W" | `#eeaa00` | warmup `#f5a524` |
| exercise name, rest timer text, Finish, Skip, links | `#008cff` (the brand blue) | accent (placeholder violet) |
| rest panel | `#1c1c1e`, buttons `#2c2c2e`, progress bar blue on `#2c2c2e` | surface, surface-raised, accent |
| action sheet | sheet `#161618`, rows `#1c1c1e`, dividers `#2c2c2e`, destructive `#e34b37` | rows surface, destructive danger |
| search field | `#323336` | one step above surface |
| Previous text in a completed row | `#f2f4f7` | full text colour (rule) |

**Colour collision fixed:** the original uses blue for interactive things and green for completed sets. My first placeholder accent was green, which would have made "done" and "tap me" look the same, so the placeholder accent is now violet.

**Contrast:** 26 pairs, 0 failing. One pair failed on the way (muted text on the green row, 3.18:1). The fix is the rule above, not a lighter muted colour.

**Unexplained:** the yellow warning triangle next to "Rest Timer", the alarm icon in the header, and what the thin line under the header measures. They are not copied until we know what they mean.
