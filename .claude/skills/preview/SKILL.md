---
name: preview
description: Push the current branch to its associated preview Shopify theme and return a shareable preview URL. Resolves the theme from the current branch, creating one on demand for unmapped branches.
allowed-tools:
  - Bash
  - AskUserQuestion
  - Read
  - Write
  - Edit
---

# Push to a Preview Theme

Push the current branch's theme files to a preview theme so the work can be reviewed without an admin login, via a shareable preview URL.

**The branch drives the target.** The theme is resolved from whatever branch you're on, not from a fixed default. Branches with no mapping get a preview theme created for them on demand. An explicit target argument overrides the branch association when you need a one-off.

## The themes manifest

`.claude/themes.json` maps targets to branches:

```json
{
  "themes": {
    "live":    { "detect": { "type": "role", "value": "live" }, "branch": "main" },
    "preview": { "detect": { "type": "name_contains", "value": "Ciaran SEO" }, "branch": "seo-preview" }
  }
}
```

Each entry supports:

- `detect` — how to resolve the theme at runtime. Never hardcode an ID in this skill.
  - `type: "id"` → `value` is the theme ID. Preferred for auto-created themes; stable across renames.
  - `type: "name_contains"` → case-insensitive substring match on theme name.
  - `type: "role"` → match by role (`live`, etc.). Only used by `live`.
- `branch` — the git branch this theme belongs to.
- `links` *(optional)* — array of store-relative paths to print as deep links, e.g. `["/collections/gold", "/products/some-handle"]`. Use this instead of hardcoding per-target URLs.

The `live` entry is **never** a valid push target.

## Process

1. **Parse `$ARGUMENTS`**
   - Tokens may include, in any order:
     - a target name matching a non-`live` key under `themes` → explicit target override
     - `force` → full push mode
     - a bare number `N` → incremental push against `HEAD~N`
   - Anything else: stop and ask rather than guessing.
   - Examples:
     - `/preview` → target from current branch, mode `HEAD~1`
     - `/preview force` → target from current branch, full push
     - `/preview 3` → target from current branch, mode `HEAD~3`
     - `/preview preview` → explicit target `preview`, mode `HEAD~1`
     - `/preview preview force` → explicit target `preview`, full push

2. **Read the manifest and current branch**
   - Read `.claude/themes.json`. If missing, stop and tell the user.
   - Run `git branch --show-current` → `CURRENT_BRANCH`
   - If detached HEAD, stop: "Detached HEAD — check out a branch first."

3. **Resolve the target**

   **a. Explicit target given:**
   - Look up `themes.<target>`. If absent, stop and list available non-`live` targets.
   - If the entry's `branch` ≠ `CURRENT_BRANCH`, **ask for confirmation**, showing both:
     "You're on `<CURRENT_BRANCH>` but target **<target>** is associated with `<entry.branch>`. Push `<CURRENT_BRANCH>` to it anyway?"
     - Only proceed on explicit confirmation.

   **b. No explicit target — reverse-lookup by branch:**
   - Find non-`live` entries whose `branch` equals `CURRENT_BRANCH`.
   - Exactly one match → use it.
   - More than one match → list them and ask which to use.
   - Zero matches → go to step 4 (auto-create).
   - Never fall back to an arbitrary default target. An unmapped branch means create, not borrow someone else's theme.

4. **Auto-create a theme for an unmapped branch**
   - Build the name: `Preview — <CURRENT_BRANCH>` (em dash). Truncate to 50 characters if longer.
   - Check no existing theme already has that exact name (`shopify theme list --json`). If one does, reuse it and just record the mapping — do not create a duplicate.
   - Tell the user what will be created and ask for confirmation.
   - Create and push in one step:
     `shopify theme push --unpublished --theme "<NAME>" --json --nodelete`
     - This creates a new **unpublished** theme and pushes the full working branch to it.
     - Parse the JSON result for the new theme ID and `preview_url`.
   - Record the mapping in `.claude/themes.json` under a key derived from the branch (strip any `feature/` prefix, kebab-case), using a stable ID detector:
     ```json
     "<key>": { "detect": { "type": "id", "value": <NEW_ID> }, "branch": "<CURRENT_BRANCH>" }
     ```
   - Validate the JSON after writing.
   - Because the create step already pushed everything, **skip steps 7–9** and go straight to step 10.

5. **Resolve the theme from the detector**
   - `type: "id"` → `shopify theme list --json` and match the ID. If absent, stop: "Theme <id> no longer exists — it may have been deleted. Remove or update the `<target>` entry in the manifest."
   - `type: "name_contains"` → `shopify theme list --json`, case-insensitive substring filter.
   - 0 matches → stop: "No theme found for target **<target>**. Has it been renamed or deleted?"
   - >1 matches → list them and stop: "Multiple themes match — switch the entry to a `type: \"id\"` detector to disambiguate."
   - Display: "Target: **<target>** → **{name}** (ID: {id}), branch `<entry.branch>`"

6. **Pre-flight safety checks**
   - Detect the live theme: `shopify theme list --role=live --json`
   - If the resolved theme ID equals the live theme ID, **STOP IMMEDIATELY**: "Resolved target is the live theme — refusing to push." This check is unconditional and cannot be overridden by any argument.
   - Run `git status` (never use the `-uall` flag). If there are uncommitted changes to theme directories, warn the user, suggest `/commit`, and stop for confirmation.

7. **Decide push mode**
   - `force` present → full push mode
   - Otherwise → incremental
   - Display the chosen mode.

8. **Full push mode** (`force`)
   - Warn: "About to overwrite the entire **<target>** theme '{name}' (ID: {id}) with `<CURRENT_BRANCH>`. This replaces any drift on that theme."
   - Ask for confirmation.
   - Run: `shopify theme push --theme <THEME_ID> --nodelete`

9. **Incremental push mode** (default)
   - Determine changed files: `git diff --name-only HEAD~<N>` (N defaults to 1)
   - Filter to valid theme directories only: `assets/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`, `templates/`
   - If no valid theme files changed, say so and stop.
   - If more than 50 files changed, suggest `force` mode instead.
   - List the files and ask for confirmation.
   - Run: `shopify theme push --theme <THEME_ID> --nodelete --only <file1> --only <file2> ...`

10. **Print share URLs**
    - Base: `https://thepromiseco.com/?preview_theme_id=<THEME_ID>`
    - Then one line per path in the entry's `links` array, if present:
      `https://thepromiseco.com<path>?preview_theme_id=<THEME_ID>`
    - Note that `?preview_theme_id=` links expire per-session after roughly 14 days.

## Rules

- NEVER use `--allow-live`, `--live`, or `--publish`. This skill is preview-only.
- NEVER push without confirming the resolved theme is not the live theme.
- NEVER treat the `live` manifest entry as a push target.
- NEVER push uncommitted changes without confirmation.
- NEVER hardcode a theme ID in this file — always resolve via the manifest plus runtime detection.
- NEVER silently reuse a mismatched target: a branch/target mismatch always requires explicit confirmation.
- Do not stage or commit `.claude/` — manifest updates are left as working-tree changes for the user.
- Always use UK spelling in output.
