---
name: preview
description: Push the current branch to a preview Shopify theme and return a shareable preview URL
allowed-tools:
  - Bash
  - AskUserQuestion
  - Read
---

# Push to a Preview Theme

Push the current branch's theme files to a long-lived preview theme so the work can be reviewed without admin login via a shareable preview URL. Supports multiple preview targets defined in `.claude/themes.json` (e.g. SEO preview, Co-Lab preview).

## Process

1. **Parse the target from `$ARGUMENTS`**
   - The first token may be a target name (matches a key under `themes` in the manifest, other than `live`)
   - If the first token is a known target key (e.g. `colab`, `preview`), use it as the target and drop it from the remaining arguments
   - If no target token is given, default to `preview` for back-compat
   - The remaining tokens are interpreted as mode: `force`, a number for `HEAD~N`, or empty for `HEAD~1`
   - Examples:
     - `/preview` → target `preview`, mode `HEAD~1`
     - `/preview colab` → target `colab`, mode `HEAD~1`
     - `/preview colab force` → target `colab`, full push
     - `/preview colab 3` → target `colab`, mode `HEAD~3`
     - `/preview force` → target `preview`, full push

2. **Read the themes manifest**
   - Read `.claude/themes.json` from the repo root
   - Look up the entry under `themes.<target>`
   - If the manifest is missing or the target entry is absent, stop and inform the user (list the available targets)

3. **Resolve the target theme**
   - Honour the entry's `detect`:
     - `type: "role"` → run `shopify theme list --role=<value> --json`
     - `type: "name_contains"` → run `shopify theme list --json` and filter (case-insensitive substring match) by `value`
   - If the filter matches 0 themes, stop: "No <target> theme found matching '<value>'. Has it been renamed or deleted?"
   - If the filter matches >1 themes, list them and stop: "Multiple themes match — refine the manifest detector or rename to disambiguate"
   - Display: "Target: **<target>** → **{name}** (ID: {id})"

4. **Pre-flight safety checks**
   - Detect the live theme separately: `shopify theme list --role=live --json`
   - If the resolved target theme ID equals the live theme ID, **STOP IMMEDIATELY**: "Resolved target theme is the live theme — refusing to push"
   - Confirm the current branch matches the entry's `branch`:
     - Run `git branch --show-current`
     - If it doesn't match, stop: "You're on {current_branch}. /preview <target> must be run from {expected_branch}. Switch branches first."

5. **Check the working tree**
   - Run `git status` (never use `-uall` flag)
   - If there are uncommitted changes, warn the user and suggest `/commit` first
   - Stop and wait for confirmation

6. **Decide push mode**
   - If remaining arguments contain the word `force` → full push mode (used to overwrite a stale preview theme)
   - Otherwise → incremental push mode (only files that changed)
   - Display the chosen mode

7. **Full push mode** (when `force`)
   - Show the user: "About to overwrite the entire <target> theme '{name}' (ID: {id}) with the current branch. This will replace any drift on the preview theme."
   - Ask for confirmation
   - Run: `shopify theme push --theme <THEME_ID> --nodelete`

8. **Incremental push mode** (default)
   - If remaining arguments contain a number, use it as the commit count: `git diff --name-only HEAD~<N>`
   - Otherwise default to `git diff --name-only HEAD~1`
   - Filter to valid Shopify theme directories: `assets/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`, `templates/`
   - If no valid theme files changed, tell the user and stop
   - If more than 50 files changed, suggest `force` mode instead
   - List files to be pushed; ask for confirmation
   - Run: `shopify theme push --theme <THEME_ID> --nodelete --only <file1> --only <file2> ...`

9. **Print share URLs**
   - Build the base preview URL: `https://thepromiseco.com/?preview_theme_id=<THEME_ID>`
   - Print useful deep links the user can share:
     - Homepage: `https://thepromiseco.com/?preview_theme_id=<THEME_ID>`
     - For Co-Lab target, also print: `https://thepromiseco.com/products/promise-heart-solitaire-ring-co-lab-test?preview_theme_id=<THEME_ID>`
     - For SEO target, also print:
       - Gold collection: `https://thepromiseco.com/collections/gold?preview_theme_id=<THEME_ID>`
       - Silver collection: `https://thepromiseco.com/collections/silver?preview_theme_id=<THEME_ID>`
   - Note: the `?preview_theme_id=` link expires per-session after ~14 days

## Rules

- NEVER use `--allow-live`. This skill is preview-only.
- NEVER push without confirming the resolved theme is NOT the live theme.
- NEVER push from a branch other than the one declared in the target's `branch`.
- NEVER push uncommitted changes.
- Always read theme IDs from the manifest + runtime detection — never hardcode.
- Always use UK spelling in output.
- Default target is `preview` for back-compat. Other targets must be explicit (`/preview colab`, etc.).
