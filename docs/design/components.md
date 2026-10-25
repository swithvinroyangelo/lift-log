# Component specs

Written from 4 reference screenshots (Home, Workout tab, Profile, Calendar). Components marked **(unseen)** are not in the screenshots, so their layout is a sensible default, not a copy. Live workout, set table, rest timer, exercise menu and exercise picker were added after a second batch of screenshots. All labels, empty states and icons are written fresh or come from an open icon set (Lucide). The reference app's exercise illustrations, logo and PRO badge are not reproduced.

Global rules for every component: real HTML elements (`button`, `a`, `nav`, `table`), a visible 2px accent focus ring, touch targets at least 44 px, colours and sizes only from tokens, and motion that respects reduced-motion.

```
TabBar
  variants  3 tabs: Home, Workout, Profile
  states    selected (accent icon and label), unselected (muted)
  tokens    bg surface, text-2xs, height 49 plus the safe-area inset
  a11y      nav with aria-label, aria-current="page" on the selected tab
  used on   all screens (hidden during a live workout, so it can't be tapped by accident: decision, not observed)

PageHeader
  variants  title with dropdown chevron, title with right-side icon buttons (search, bell, edit, share, settings)
  states    default
  tokens    text lg, margin 16
  a11y      h1 for the title, icon buttons need aria-labels
  used on   S02, S07, S11

ActionBar (full-width, e.g. "Start Empty Workout")
  variants  icon + label
  sizes     48px tall
  states    default, pressed, focus-visible, disabled
  tokens    bg surface, radius sm, text sm/600, icon 20px
  used on   S02

TileButton (New Routine, Explore, Statistics, Exercises, Measures, Calendar)
  variants  two-up grid, icon left of label
  sizes     48px tall, two columns with a 16px gap
  states    default, pressed, focus-visible
  tokens    bg surface, radius sm
  used on   S02, profile dashboard

Button
  variants  primary (full width, accent), secondary (surface), ghost, danger
  sizes     md 40px (primary in cards), lg 48px
  states    default, hover, active, focus-visible, disabled, loading (keeps label for screen readers)
  tokens    primary: bg accent, text on-accent, radius sm, text sm/600
  used on   all

SectionHeader (collapsible, "My Routines (4)")
  variants  expanded, collapsed; shows a live count
  states    default, focus-visible
  tokens    text sm muted, triangle icon rotates 90 degrees (motion fast)
  a11y      button with aria-expanded
  used on   S02

RoutineCard
  parts     name (text base, caps as typed), overflow menu (three dots), exercise names joined by commas and truncated to 2 lines, primary Start button
  states    default, menu open, empty routine ("No exercises yet"), long name truncates
  tokens    bg surface, radius md, padding 16, gap 16 between cards
  menu      Edit, Duplicate, Move to folder, Share, Delete (danger, asks to confirm)
  a11y      menu is a real menu button with arrow-key support; Start button names the routine ("Start Push")
  used on   S02
  note      there is NO limit on how many of these exist. That is the point of the project.

WorkoutSummaryCard (feed and history)
  parts     date line, title (lg), stat trio (Time, Volume, Records), up to 3 exercise rows ("4 sets Squat (Smith Machine)"), "See N more exercises", action row (share)
  states    default, expanded, empty
  tokens    stat labels xs muted over values sm/600, medal icon in record colour, dividers border
  skipped   like and comment buttons (social is out of scope)
  used on   S07 (history), and Home as "recent workouts" (own workouts only)

StatTrio
  variants  Time, Volume, Records
  tokens    label xs muted, value sm/600, record uses the medal icon plus count
  used on   S06, S07, S08

ExerciseThumb
  variants  round, 40px
  content   our own simple muscle-group icon. Never the original's exercise illustrations (they are licensed content)
  used on   S02, S05, S07, S08

SegmentedChips (Duration, Volume, Reps)
  variants  single select
  states    selected (accent fill, on-accent text), unselected (surface), focus-visible
  tokens    radius pill, height 36
  a11y      radiogroup
  used on   profile chart

BarChart (weekly duration, volume or reps)
  variants  range menu ("Last 3 months", plus other ranges: unseen)
  states    empty ("No workouts in this range"), filled, loading
  tokens    bars accent, gridlines border, axis labels xs muted
  a11y      a data table alternative for screen readers, bars have text labels on hover/focus
  used on   S11, profile

CalendarMonth
  parts     header with streak ("N week streak", flame in streak colour) and rest days (moon icon), weekday row, month grid, filter and share buttons
  day cell  trained day = accent circle with the day number and the routine name underneath (tiny label, text 2xs); untrained day = plain number
  states    empty month, filled, today outlined, focus-visible; tapping a trained day opens that workout
  tokens    circle accent, number text on-accent, label text 2xs muted
  a11y      grid role, each day has an aria-label ("Mon 3 Aug, Push, trained")
  used on   S09

LiveWorkoutHeader
  parts     collapse chevron + "Log Workout" label, rest-timer shortcut icon, Finish button (primary, 40px)
  states    default; thin progress line under the header (what it measures is unconfirmed: it grew after 3 sets were completed, so probably set progress)
  tokens    bg surface, Finish uses accent
  a11y      Finish names what it does ("Finish workout") and asks to confirm if sets are incomplete (decision, not observed)
  used on   S04

LiveStatsStrip
  parts     Duration (running clock, accent colour), Volume (kg), Sets (count), muscle diagram on the right
  states    zero ("5s", "0 kg", "0"), running, finished
  tokens    labels xs muted over values sm/600
  note      the original's muscle diagram is a licensed illustration. Ours is a simple original icon, or left out (feature is "could")
  used on   S04

RoutineNote (shown at the top of a live workout)
  parts     the routine's own note text, plain text, wraps
  used on   S04

ExerciseHeader
  parts     round thumbnail (our own icon), exercise name as an accent-coloured button that opens the exercise's stats, overflow menu (three dots), notes field ("Add notes here..." placeholder, muted), optional "Alt:" line, rest timer line
  states    default, notes focused, menu open
  menu      bottom sheet: Reorder Exercises, Replace Exercise, Add To Superset, Remove Exercise (danger, asks to confirm)
  a11y      the name button's label includes "view history"; the menu is a real dialog with focus trap
  used on   S03, S04

RestTimerLine ("Rest Timer: 2min 0s" under each exercise)
  parts     timer icon + text in accent colour, tappable to change the duration; a small warning triangle follows it in the original (its meaning was not visible: do not copy it blindly, decide what we want to warn about)
  states    default
  used on   S03, S04

SetTable
  columns   SET, PREVIOUS, KG (or LB), REPS, check. Column headers are caps, 2xs/xs, muted
  row       48px tall, alternating bg and surface (zebra), set label left, numeric fields centred, check button right
  set label working sets are numbered 1, 2, 3...; a warm-up set shows "W" in the warmup colour and does not take a number. Observed order in the reference: 1, 2, 3, W, 4, so the type is per-row and order is free
  PREVIOUS  last session's "45kg x 12" in muted text. In a completed row it switches to full text colour (muted on green fails contrast)
  fields    weight and reps are inputs: numeric keyboard, select-all on focus, 48px tall
  check     idle: grey button with a white check. Done: success button, row fills with success-surface, and the rest timer starts
  states    empty, filled, completed, focus-visible on each field, error (reps over 1000 or negative: message in danger plus icon)
  a11y      real table markup; check is a checkbox button named "Set 2 complete"
  used on   S03, S04, S08

AddSetButton
  parts     full-width bar with plus icon and "Add Set"
  tokens    bg surface, radius md, 48px
  used on   S03, S04

RestTimerPanel (docked at the bottom while a rest is running)
  parts     thin progress bar across the top, "-15" button, big countdown (mm:ss), "+15" button, Skip (primary)
  states    running, paused, finished (vibrates or beeps if the browser allows), dismissed
  tokens    bg surface, secondary buttons surface-raised, progress accent over a surface-raised track
  note      the countdown must survive the phone locking: compute remaining time from an end timestamp, never by counting ticks
  used on   S04

ActionSheet (the exercise menu)
  parts     drag handle, a rounded list of rows (icon + label), the last row destructive
  tokens    sheet bg is darker than the rows (rows sit on surface), radius sheet-radius, dimmed page behind (scrim at 50%)
  states    open, closing
  a11y      role=dialog, focus trap, Escape and scrim tap close, first row focused
  used on   S04, S03

ExercisePicker (full screen, used for Add and Replace)
  parts     nav row (Cancel left, title, Create right), search field, two filter buttons (All Equipment, All Muscles), Suggested Exercises, Recent Exercises, each row = thumbnail, name, muscle in muted, and a stats shortcut icon button
  states    empty search, results, no results ("Nothing matches. Create it?" with the Create action), loading
  tokens    search field is one step lighter than surface
  behaviour on Replace, Suggested shows exercises for the same muscle (inferred from the screenshot, where a chest press showed three chest exercises)
  a11y      search is a real input with a label, rows are buttons, filters open a menu
  used on   S05

Input, Modal, Toast, EmptyState (unseen)
  Input     48px, bg surface, 1px border-input (3:1 or better), error text in danger with an icon, never colour alone
  Modal     bottom sheet on phone, centred on desktop, focus trapped, Escape closes
  Toast     bottom, above the tab bar, 4s, role=status
  EmptyState  one line, one action button
```
