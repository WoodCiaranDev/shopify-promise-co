---
name: dev
description: Spin up a hot-reload local Shopify theme dev server for the current branch, so saving a file shows up at http://127.0.0.1:9292 instantly
allowed-tools:
  - Bash
  - AskUserQuestion
  - Read
---

# Local Theme Dev Server

Run `shopify theme dev` so the working tree streams to a local preview at `http://127.0.0.1:9292`. Saving a `.liquid`, `.css`, or `.js` file hot-reloads the local preview — no `theme push` needed. The remote theme is untouched until `/preview` or `/deploy` is run.

**The branch drives the target.** The theme is resolved from the current branch via `.claude/themes.json` (see the manifest documentation in the `/preview` skill). An explicit target argument overrides it. A branch with no mapping just uses the CLI's own development theme — nothing needs provisioning for local dev.

## Process

1. **Parse `$ARGUMENTS`**
   - An optional single token: a target name matching a non-`live` key under `themes` → explicit override
   - No token → resolve from the current branch
   - Examples:
     - `/dev` → target from current branch
     - `/dev preview` → explicit `preview` (SEO preview theme)

2. **Read the manifest and current branch**
   - Read `.claude/themes.json`. If missing, note it and continue — step 3c still works.
   - Run `git branch --show-current` → `CURRENT_BRANCH`

3. **Resolve the target**

   **a. Explicit target given:**
   - Look up `themes.<target>`. If absent, stop and list available non-`live` targets.
   - If the entry's `branch` ≠ `CURRENT_BRANCH`, warn and ask before proceeding: hot-reloaded files won't match what that theme's own branch contains.

   **b. No explicit target — reverse-lookup by branch:**
   - Find non-`live` entries whose `branch` equals `CURRENT_BRANCH`.
   - Exactly one match → use it.
   - More than one → list them and ask which to use.
   - Zero matches → 3c.

   **c. No mapping for this branch — use a development theme:**
   - Say so plainly: "No theme mapped to `<CURRENT_BRANCH>` — using a Shopify development theme for local dev."
   - Skip steps 4 and 5, and run the dev server **without** `--theme` (step 6). The CLI creates or reuses its own development theme, which is exactly right for localhost work.
   - Do not auto-create a preview theme here. That's `/preview`'s job, when there's something to share.

4. **Resolve the theme from the detector**
   - `type: "id"` → `shopify theme list --json`, match the ID. If absent, stop: "Theme <id> no longer exists — update the `<target>` entry in the manifest."
   - `type: "name_contains"` → `shopify theme list --json`, case-insensitive substring filter.
   - 0 matches → stop: "No theme found for target **<target>**. Has it been renamed or deleted?"
   - >1 matches → list them and stop; suggest switching that entry to a `type: "id"` detector.
   - Display: "Target: **<target>** → **{name}** (ID: {id}), branch `<entry.branch>`"

5. **Safety: refuse if the resolved theme is the live theme**
   - Run `shopify theme list --role=live --json` separately
   - If the IDs match, **STOP** — `theme dev` against live would proxy every save straight to production. This cannot be overridden by any argument.

6. **Start the dev server**
   - Run in the foreground so the user can `Ctrl-C` to stop.
   - With a resolved target:
     ```sh
     shopify theme dev --theme <THEME_ID> --store thepromiseringco.myshopify.com
     ```
   - With no mapping (3c):
     ```sh
     shopify theme dev --store thepromiseringco.myshopify.com
     ```
   - The CLI prints the local URL (typically `http://127.0.0.1:9292`) and watches the working tree.

7. **Print useful URLs alongside the CLI output**
   - Homepage: `http://127.0.0.1:9292/`
   - Then one line per path in the resolved entry's `links` array, if it has one:
     `http://127.0.0.1:9292<path>`
   - Do not hardcode per-target paths in this file — put them in the manifest entry's `links`.

## Rules

- NEVER run `shopify theme dev` against the live theme — it would proxy local edits directly to production.
- NEVER treat the `live` manifest entry as a dev target.
- ALWAYS resolve via the manifest plus runtime detection; never hardcode IDs.
- NEVER fall back to an arbitrary default target when the branch has no mapping — use a development theme instead.
- The dev server serves the local working tree, so uncommitted changes ARE served. That's the point. It's localhost-only by default; this skill does not enable `--tunnel`.
- Always use UK spelling in output.
