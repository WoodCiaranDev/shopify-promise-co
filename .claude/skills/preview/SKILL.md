---
name: preview
description: Push the current branch to the SEO preview Shopify theme and return a shareable preview URL
allowed-tools:
  - Bash
  - AskUserQuestion
  - Read
---

# Push to SEO Preview Theme

Push the current branch's theme files to the long-lived SEO Preview theme so the SEO consultant (or anyone without admin login) can review changes via a shareable preview URL.

## Process

1. **Read the themes manifest**
   - Read `.claude/themes.json` from the repo root
   - Look up the `preview` entry under `themes`
   - If the manifest is missing or the `preview` entry is absent, stop and inform the user

2. **Resolve the SEO Preview theme**
   - Honour `themes.preview.detect`:
     - `type: "role"` → run `shopify theme list --role=<value> --json`
     - `type: "name_contains"` → run `shopify theme list --json` and filter (case-insensitive substring match) by `value`
   - If the filter matches 0 themes, stop: "No SEO Preview theme found matching '<value>'. Has it been renamed or deleted?"
   - If the filter matches >1 themes, list them and stop: "Multiple themes match — refine the manifest detector or rename to disambiguate"
   - Display: "Preview theme: **{name}** (ID: {id})"

3. **Pre-flight safety checks**
   - Detect the live theme separately: `shopify theme list --role=live --json`
   - If the resolved preview theme ID equals the live theme ID, **STOP IMMEDIATELY**: "Resolved preview theme is the live theme — refusing to push"
   - Confirm the current branch matches `themes.preview.branch` (default `seo-preview`):
     - Run `git branch --show-current`
     - If it doesn't match, stop: "You're on {current_branch}. /preview must be run from {expected_branch}. Switch branches first."

4. **Check the working tree**
   - Run `git status` (never use `-uall` flag)
   - If there are uncommitted changes, warn the user and suggest `/commit` first
   - Stop and wait for confirmation

5. **Decide push mode**
   - If `$ARGUMENTS` contains the word `force` → full push mode (used to overwrite a stale preview theme)
   - Otherwise → incremental push mode (only files that changed)
   - Display the chosen mode

6. **Full push mode** (when `force`)
   - Show the user: "About to overwrite the entire SEO Preview theme '{name}' (ID: {id}) with the current branch. This will replace any drift on the preview theme."
   - Ask for confirmation
   - Run: `shopify theme push --theme <PREVIEW_ID> --nodelete`

7. **Incremental push mode** (default)
   - If `$ARGUMENTS` is a number, use it as the commit count: `git diff --name-only HEAD~<N>`
   - Otherwise default to `git diff --name-only HEAD~1`
   - Filter to valid Shopify theme directories: `assets/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`, `templates/`
   - If no valid theme files changed, tell the user and stop
   - If more than 50 files changed, suggest `force` mode instead
   - List files to be pushed; ask for confirmation
   - Run: `shopify theme push --theme <PREVIEW_ID> --nodelete --only <file1> --only <file2> ...`

8. **Print share URLs**
   - Build the base preview URL: `https://thepromiseco.com/?preview_theme_id=<PREVIEW_ID>`
   - Print useful deep links the user can share:
     - Homepage: `https://thepromiseco.com/?preview_theme_id=<PREVIEW_ID>`
     - Gold collection: `https://thepromiseco.com/collections/gold?preview_theme_id=<PREVIEW_ID>`
     - Silver collection: `https://thepromiseco.com/collections/silver?preview_theme_id=<PREVIEW_ID>`
   - Note: the `?preview_theme_id=` link expires per-session after ~14 days

## Rules

- NEVER use `--allow-live`. This skill is preview-only.
- NEVER push without confirming the resolved theme is NOT the live theme.
- NEVER push from a branch other than the one declared in `themes.preview.branch`.
- NEVER push uncommitted changes.
- Always read theme IDs from the manifest + runtime detection — never hardcode.
- Always use UK spelling in output.
- `$ARGUMENTS` is `force` for a full push, or a number for `HEAD~N` incremental push, or empty for `HEAD~1`.
