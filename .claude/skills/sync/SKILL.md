---
name: sync
description: Pull the live Shopify theme, commit client changes, and optionally push to GitHub
allowed-tools:
  - Bash
  - AskUserQuestion
---

# Sync Live Theme

Pull the live Shopify theme down, commit any client-side changes, and optionally push to GitHub.

## Process

1. **Detect the live theme via the themes manifest**
   - Read `.claude/themes.json` and look up `themes.live`
   - Honour `themes.live.detect`:
     - `type: "role"` → `shopify theme list --role=<value> --json`
     - `type: "name_contains"` → `shopify theme list --json` filtered case-insensitively
   - If 0 or >1 themes match, stop and inform the user
   - Parse the JSON output to extract the theme ID and name
   - Display: "Live theme: **{name}** (ID: {id})"
   - **Branch guard**: confirm the current branch matches `themes.live.branch` (default `main`). If not, stop and ask the user to switch.
   - If the manifest is missing, fall back to `shopify theme list --role=live --json` and warn the user the manifest is absent

2. **Check the working tree**
   - Run `git status` (never use `-uall` flag)
   - If there are uncommitted changes, **warn the user**: "You have uncommitted changes — pulling will overwrite local files. Commit or stash first."
   - Stop and wait for the user to confirm they want to proceed, or suggest using `/commit` first

3. **Pull the live theme**
   - Run `shopify theme pull --theme <LIVE_ID>`
   - Wait for the pull to complete

4. **Show what changed**
   - Run `git diff --stat` to show a summary of changes
   - If there are no changes, tell the user "Theme is already up to date" and stop

5. **Commit client changes**
   - Stage theme directories only: `git add assets/ config/ layout/ locales/ sections/ snippets/ templates/`
   - Commit with message: `Client changes`
   - No commit body, no Co-Authored-By line
   - Always use UK spelling in any output

6. **Ask about pushing**
   - Ask the user: "Push to GitHub?"
   - If yes: `git push`
   - If no: continue

7. **Ask about refreshing each preview branch**
   - Read `.claude/themes.json` and iterate over every entry under `themes` whose key is **not** `live`
   - For each entry (e.g. `preview`, `colab`), ask the user: "Also refresh the **{key}** branch (`{branch}`) with these client changes?"
   - If yes for a given entry:
     - `git checkout <branch>`
     - `git merge main --no-ff -m "Merge main into <branch>"`
       - For the `preview`/`seo-preview` branch specifically: resolve any heading_tag conflicts in favour of seo-preview to preserve the h1 experiments
       - For other branches: resolve conflicts as they arise; if any conflict is unclear, stop and ask the user
     - Return to `main` with `git checkout main`
     - Remind the user to run `/preview <key>` from `<branch>` to push the refreshed branch to that theme
   - If no for an entry: skip it and move to the next
   - When all entries are handled, stop

## Rules

- NEVER stage `.env`, `.claude/`, credentials, or any non-theme files
- NEVER push to GitHub without asking the user first
- NEVER use `git add .` or `git add -A`
- NEVER amend existing commits
- Always auto-detect the live theme at runtime via `.claude/themes.json` — never hardcode a theme ID
- NEVER sync onto any branch other than `themes.live.branch`
- Always use UK spelling in all output (e.g. "colour" not "color", "synchronise" not "synchronize")
- If `$ARGUMENTS` is provided, use it as context (e.g. a note for the commit or instructions)
