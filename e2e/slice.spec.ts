import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";

const errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
});

async function newRoutine(page: Page, name: string, exerciseNames: string[] = []) {
  await page.goto("/workout");
  await page.getByRole("link", { name: "New Routine" }).click();
  await page.getByLabel("Routine name").fill(name);
  if (exerciseNames.length) {
    await page.getByRole("button", { name: "Add Exercise" }).click();
    const picker = page.getByRole("dialog", { name: "Add Exercise" });
    for (const n of exerciseNames) await picker.getByRole("button", { name: new RegExp(n.replace(/[()]/g, "\\$&")) }).first().click();
    await picker.getByRole("button", { name: /Add \d+ exercise/ }).click();
  }
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/workout$/);
}

test("core loop: routine, live workout, close mid-session, finish, history, previous values, backup", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());

  // ---- 1. unlimited routines: the original's free plan stops at 4
  await newRoutine(page, "Push", ["Bench Press (Dumbbell)", "Incline Chest Press (Machine)"]);
  for (const n of ["Pull", "Legs", "Upper", "Lower", "Arms"]) await newRoutine(page, n);
  await expect(page.getByRole("button", { name: /My Routines \(6\)/ })).toBeVisible();

  // set a target on the Push routine so we also test editing
  await page.getByRole("button", { name: "Options for Push" }).click();
  await page.getByRole("button", { name: "Edit routine" }).click();
  const benchEdit = page.getByRole("region", { name: "Bench Press (Dumbbell)" });
  await benchEdit.getByLabel("Set 1 weight in kg").fill("45");
  await benchEdit.getByLabel("Set 1 reps").fill("12");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  // ---- 2. start it
  await page.getByRole("button", { name: "Start Push" }).click();
  await expect(page).toHaveURL(/\/live$/);
  const bench = page.getByRole("region", { name: "Bench Press (Dumbbell)" });
  await expect(bench.getByLabel("Set 1 weight in kg")).toHaveValue("45");
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0); // tab bar hidden mid-workout

  // completing a set needs reps; set 2 has none
  await bench.getByRole("checkbox", { name: "Set 2 complete" }).click();
  await expect(page.getByRole("status")).toContainText("Enter the reps first");

  // complete set 1 -> row turns done and the rest timer starts
  await bench.getByRole("checkbox", { name: "Set 1 complete" }).click();
  await expect(bench.getByRole("checkbox", { name: "Set 1 complete" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("timer", { name: "Rest timer" })).toBeVisible();
  await expect(page.getByRole("timer")).toContainText(/0[01]:\d\d/);

  // ---- 3. the phone locks / the tab is closed mid-workout: reload and nothing is lost
  await page.reload();
  await expect(page).toHaveURL(/\/live$/);
  const bench2 = page.getByRole("region", { name: "Bench Press (Dumbbell)" });
  await expect(bench2.getByRole("checkbox", { name: "Set 1 complete" })).toHaveAttribute("aria-checked", "true");
  await expect(bench2.getByLabel("Set 1 weight in kg")).toHaveValue("45");
  await expect(page.getByRole("timer")).toBeVisible(); // the rest timer survived too

  // leave to another tab: a banner offers the way back
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Workout in progress/ })).toBeVisible();
  await page.getByRole("link", { name: /Workout in progress/ }).click();
  await expect(page).toHaveURL(/\/live$/);
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("timer")).toHaveCount(0);

  // ---- 4. log a second set and finish with unfinished sets left over
  const b = page.getByRole("region", { name: "Bench Press (Dumbbell)" });
  await b.getByLabel("Set 2 weight in kg").fill("50");
  await b.getByLabel("Set 2 reps").fill("10");
  await b.getByRole("checkbox", { name: "Set 2 complete" }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText("1,040 kg")).toBeVisible(); // 45x12 + 50x10 = 1,040 (live total)
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Finish workout?" })).toContainText(/not done and will be left out/);
  await page.getByRole("button", { name: "Finish anyway" }).click();

  // ---- 5. saved: detail page and Home
  await expect(page).toHaveURL(/\/history\//);
  await expect(page.getByRole("status")).toContainText("Workout saved");
  await expect(page.getByText("1,040 kg").first()).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("article", { name: /Push, Today/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Workout in progress/ })).toHaveCount(0); // draft is gone

  // ---- 6. next time, "Previous" shows what you did
  await page.goto("/workout");
  await page.getByRole("button", { name: "Start Push" }).click();
  const again = page.getByRole("region", { name: "Bench Press (Dumbbell)" });
  await expect(again.getByRole("table")).toContainText("45kg x 12");
  await expect(again.getByRole("table")).toContainText("50kg x 10");
  // discard this one so the backup test starts clean
  await page.getByRole("button", { name: "Discard Workout" }).click();
  await page.getByRole("dialog", { name: "Discard this workout?" }).getByRole("button", { name: "Discard workout" }).click();
  await expect(page).toHaveURL(/\/workout$/);

  // ---- 7. backup and restore
  await page.goto("/profile");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download backup" }).click()]);
  const file = await dl.path();
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(parsed.data.workouts).toHaveLength(1);
  expect(parsed.data.routines).toHaveLength(6);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText("Workouts").locator("..").getByText("0")).toBeVisible();
  await page.getByLabel("Choose backup file").setInputFiles(file);
  await expect(page.getByRole("status")).toContainText("Restored 1 workouts and 6 routines");

  expect(errors, errors.join("\n")).toEqual([]);
});

test("exercise menu: replace, move, remove, superset; custom exercise", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/workout");
  await page.getByRole("button", { name: "Start Empty Workout" }).click();
  await expect(page).toHaveURL(/\/live$/);
  await page.getByRole("button", { name: "Add Exercise" }).click();
  const picker = page.getByRole("dialog", { name: "Add Exercise" });
  await picker.getByLabel("Search exercises").fill("pull up");
  await picker.getByRole("button", { name: /^Pull Up$|Pull Up/ }).first().click();
  await picker.getByLabel("Search exercises").fill("squat");
  await picker.getByRole("button", { name: /Squat \(Barbell\)/ }).first().click();
  await picker.getByRole("button", { name: /Add 2 exercises/ }).click();
  const blocks = page.getByRole("region").filter({ has: page.getByRole("table") });
  await expect(blocks).toHaveCount(2);

  // superset the second with the first
  await page.getByRole("button", { name: /Options for Squat \(Barbell\)/ }).click();
  await page.getByRole("button", { name: "Superset with the exercise above" }).click();
  await expect(page.getByText(/Superset \(with the one above\)/)).toBeVisible();

  // move down / up
  await page.getByRole("button", { name: /Options for Pull Up/ }).click();
  await page.getByRole("button", { name: "Move down" }).click();
  await expect(blocks.first()).toHaveAccessibleName(/Squat/);

  // replace with a filtered pick (equipment filter)
  await page.getByRole("button", { name: /Options for Squat \(Barbell\)/ }).click();
  await page.getByRole("button", { name: "Replace Exercise" }).click();
  const rp = page.getByRole("dialog", { name: "Replace Exercise" });
  await rp.getByRole("button", { name: "All Equipment" }).click();
  await page.getByRole("button", { name: "Machine", exact: true }).click();
  await rp.getByLabel("Search exercises").fill("leg press");
  await rp.getByRole("button", { name: /Leg Press \(Machine\)/ }).first().click();
  await expect(page.getByRole("region", { name: "Leg Press (Machine)" })).toBeVisible();

  // remove
  await page.getByRole("button", { name: /Options for Pull Up/ }).click();
  await page.getByRole("button", { name: "Remove Exercise" }).click();
  await expect(blocks).toHaveCount(1);

  // custom exercise from the picker, and a duplicate name is refused
  await page.getByRole("button", { name: "Add Exercise" }).click();
  const p2 = page.getByRole("dialog", { name: "Add Exercise" });
  await p2.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("My Odd Cable Thing");
  await page.getByRole("button", { name: "Save exercise" }).click();
  await p2.getByRole("button", { name: /Add 1 exercise/ }).click();
  await expect(page.getByRole("region", { name: "My Odd Cable Thing" })).toBeVisible();
  await page.getByRole("button", { name: "Add Exercise" }).click();
  await page.getByRole("dialog", { name: "Add Exercise" }).getByRole("button", { name: "Create", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("my odd cable thing");
  await page.getByRole("button", { name: "Save exercise" }).click();
  await expect(page.getByText("An exercise with that name already exists.")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("nothing logged: finishing offers to discard, and a warm-up is labelled W", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/workout");
  await page.getByRole("button", { name: "Start Empty Workout" }).click();
  await page.getByRole("button", { name: "Add Exercise" }).click();
  await page.getByRole("dialog", { name: "Add Exercise" }).getByRole("button", { name: /Bench Press \(Barbell\)/ }).first().click();
  await page.getByRole("button", { name: /Add 1 exercise/ }).click();
  const ex = page.getByRole("region", { name: "Bench Press (Barbell)" });
  // turn set 3 into a warm-up: labels become 1, 2, W
  await ex.getByRole("button", { name: /Set 3, change type/ }).click();
  await page.getByRole("button", { name: "Warm-up set" }).click();
  await expect(ex.getByRole("button", { name: "Set W, change type or delete" })).toBeVisible();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Nothing logged yet" })).toBeVisible();
  await page.getByRole("button", { name: "Keep going" }).click();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("units: lb shows and stores correctly", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/profile");
  await page.getByRole("radio", { name: "lb" }).click();
  await page.goto("/workout");
  await page.getByRole("button", { name: "Start Empty Workout" }).click();
  await page.getByRole("button", { name: "Add Exercise" }).click();
  await page.getByRole("dialog", { name: "Add Exercise" }).getByRole("button", { name: /Squat \(Barbell\)/ }).first().click();
  await page.getByRole("button", { name: /Add 1 exercise/ }).click();
  const ex = page.getByRole("region", { name: "Squat (Barbell)" });
  await ex.getByLabel("Set 1 weight in lb").fill("135");
  await ex.getByLabel("Set 1 reps").fill("5");
  await ex.getByRole("checkbox", { name: "Set 1 complete" }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await ex.getByLabel("Set 1 weight in lb").blur();
  await expect(ex.getByLabel("Set 1 weight in lb")).toHaveValue("135"); // not 134.5 or 134.99
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("lift-log:v1:draft")!).workout.exercises[0].sets[0].weightKg);
  expect(stored).toBeCloseTo(61.23, 2); // kg in storage
});

test("desktop width does not scroll sideways, and every page loads without errors", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ["/", "/workout", "/profile", "/routine/new"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("routine folders: create, move a routine in, rename, delete keeps the routine", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await newRoutine(page, "Push", ["Bench Press (Dumbbell)"]);
  await newRoutine(page, "Pull", ["Pull Up"]);

  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill("Strength block");
  await page.getByRole("button", { name: "Save folder" }).click();
  await expect(page.getByRole("region", { name: "Folder Strength block" })).toBeVisible();

  await page.getByRole("button", { name: "Options for Push" }).click();
  await page.getByRole("button", { name: "Move to folder" }).click();
  await page.getByRole("button", { name: "Strength block", exact: true }).click();
  const folder = page.getByRole("region", { name: "Folder Strength block" });
  await expect(folder.getByRole("button", { name: "Start Push" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Routines not in a folder" }).getByRole("button", { name: "Start Pull" })).toBeVisible();

  // survives a reload
  await page.reload();
  await expect(page.getByRole("region", { name: "Folder Strength block" }).getByRole("button", { name: "Start Push" })).toBeVisible();

  // rename
  await page.getByRole("button", { name: "Options for folder Strength block" }).click();
  await page.getByRole("button", { name: "Rename folder" }).click();
  await page.getByLabel("Folder name").fill("Winter");
  await page.getByRole("button", { name: "Save folder" }).click();
  await expect(page.getByRole("region", { name: "Folder Winter" })).toBeVisible();

  // delete the folder: the routine stays
  await page.getByRole("button", { name: "Options for folder Winter" }).click();
  await page.getByRole("button", { name: "Delete folder" }).click();
  await page.getByRole("dialog", { name: /Delete folder Winter/ }).getByRole("button", { name: "Delete folder" }).click();
  await expect(page.getByRole("button", { name: "Start Push" })).toBeVisible();
  await expect(page.getByRole("button", { name: /My Routines \(2\)/ })).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("edit a past workout: change a set, volume recomputes, add and remove", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    const set = (id: string, w: number, r: number) => ({ id, type: "normal", weightKg: w, reps: r, rpe: null, completed: true });
    const workout = {
      id: "w-edit-1", routineId: null, title: "Chest day", notes: "", startedAt: new Date(Date.now() - 3600_000).toISOString(),
      endedAt: new Date().toISOString(),
      exercises: [{ id: "we1", exerciseId: "builtin-bench-press-dumbbell", notes: "", restSeconds: null, supersetGroup: null,
        sets: [set("s1", 40, 10), set("s2", 40, 10)] }],
    };
    localStorage.setItem("lift-log:v1", JSON.stringify({ customExercises: [], routines: [], routineFolders: [], workouts: [workout], settings: { units: "kg", defaultRestSeconds: 90, displayName: "" } }));
  });
  await page.goto("/history/w-edit-1");
  await expect(page.getByText("800 kg").first()).toBeVisible(); // 40x10 x2

  await page.getByRole("button", { name: "Edit workout" }).click();
  await page.getByLabel("Workout name").fill("Chest day (fixed)");
  const ex = page.getByRole("region", { name: "Bench Press (Dumbbell)" });
  await ex.getByLabel("Set 2 weight in kg").fill("50");
  await ex.getByRole("button", { name: "Add Set" }).click();
  await ex.getByLabel("Set 3 weight in kg").fill("20");
  await ex.getByLabel("Set 3 reps").fill("5");
  await ex.getByRole("button", { name: "Delete set 1" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();

  // sets left: 50x10 + 20x5 = 600
  await expect(page.getByRole("status")).toContainText("Changes saved");
  await expect(page.getByRole("heading", { name: "Chest day (fixed)" })).toBeVisible();
  await expect(page.getByText("600 kg").first()).toBeVisible();

  // cancel throws edits away
  await page.getByRole("button", { name: "Edit workout" }).click();
  await page.getByLabel("Workout name").fill("Nope");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Chest day (fixed)" })).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});
