---
name: push-to-dev
description: Merge the current feature branch into dev and push the changed files to the Promise Co - Dev theme
allowed-tools:
  - Bash
  - AskUserQuestion
  - Read
---

# Push to Dev

Get the current branch's work onto the **Promise Co - Dev** theme: merge the branch into `dev`, push the changed theme files, and return to where you started. Lighter than `/update-dev` — no live-theme sync involved.

The Dev theme is resolved via `.claude/themes.json` → `themes.dev` (never hardcode an ID).

## Process

1. **Record the starting point**
   - `git branch --show-current` → `START_BRANCH`
   - If already on `dev`, skip the merge (steps 3) and go straight to the push.
   - If on `main` or detached HEAD, stop and ask the user what they intend.

2. **Check the working tree**
   - `git status` (never `-uall`). If there are uncommitted changes to theme directories, ask whether to commit them first (suggest `/commit`) — never merge or push uncommitted theme work silently. Non-theme changes (`.claude/`, `CLAUDE.md`, `.env`) can be ignored.

3. **Merge the branch into dev**
   - `git checkout dev`
   - Note the pre-merge head: `git rev-parse HEAD` → `DEV_BEFORE`
   - `git merge <START_BRANCH> --no-ff -m "Merge <START_BRANCH> into dev"`
   - If already up to date, tell the user and ask whether to push anyway.
   - Resolve obvious conflicts; if any conflict is unclear, abort the merge, return to `START_BRANCH`, and ask the user.

4. **Resolve the Dev theme**
   - Read `.claude/themes.json` → `themes.dev` and resolve the theme per its detector (`type: "id"` → match against `shopify theme list --json`).
   - Verify it is **not** the live theme (`shopify theme list --role=live --json`). If it is, STOP.

5. **Push changed files**
   - Changed files: `git diff --name-only <DEV_BEFORE> HEAD`, filtered to valid theme directories (`assets/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`, `templates/`)
   - If none, say so and skip the push.
   - If more than 50 files, do a full push instead: `shopify theme push --theme <ID> --nodelete`
   - Otherwise: `shopify theme push --theme <ID> --nodelete --only <file1> --only <file2> ...`

6. **Return and report**
   - `git checkout <START_BRANCH>`
   - Print the preview URL: `https://thepromiseco.com/?preview_theme_id=<ID>`

## Rules

- NEVER push to the live theme — unconditional check, no override.
- NEVER use `--allow-live`, `--live`, or `--publish`.
- NEVER push to GitHub — this skill only touches the Shopify Dev theme.
- Always finish back on `START_BRANCH`, even if a step is aborted.
- Always use UK spelling in output.
