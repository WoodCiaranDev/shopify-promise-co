---
name: update-dev
description: Refresh the Promise Co - Dev theme — sync client changes from the live theme into main, merge main into the dev branch, and push dev to the Dev theme
allowed-tools:
  - Bash
  - AskUserQuestion
  - Read
  - Skill
---

# Update Dev Theme

Bring the **Promise Co - Dev** theme up to date with the latest client changes from the live theme. Flow: sync live → `main`, merge `main` → `dev`, push `dev` to the Dev theme.

The Dev theme is resolved via `.claude/themes.json` → `themes.dev` (never hardcode an ID).

## Process

1. **Record the starting point**
   - Run `git branch --show-current` → `START_BRANCH`
   - Run `git status` (never use `-uall`). If there are uncommitted changes to theme directories, stop and tell the user to `/commit` or stash first — this skill switches branches.

2. **Sync client changes into main**
   - `git checkout main`
   - Invoke the `sync` skill (via the Skill tool) to pull the live theme and commit client changes as `Client changes`.
   - When the sync skill asks about pushing to GitHub or refreshing preview branches, decline the preview-branch refreshes — this skill handles the dev merge itself. Pushing `main` to GitHub is fine if the user says yes.
   - If sync reports "Theme is already up to date", continue anyway — the merge below may still be needed.

3. **Merge main into dev**
   - `git checkout dev`
   - `git merge main --no-ff -m "Merge main into dev"`
   - If `dev` is already up to date with `main` and the working tree matches the Dev theme, tell the user nothing changed and skip the push (step 4) unless they ask for it.
   - If there are conflicts, resolve obvious ones; if any conflict is unclear, stop and ask the user.

4. **Push dev to the Dev theme**
   - Invoke the `preview` skill (via the Skill tool) with argument `dev force`, so the whole branch is pushed and drift on the Dev theme is replaced.
   - The preview skill's own safety checks apply (never the live theme, confirmation before a full push).

5. **Return to the starting branch**
   - `git checkout <START_BRANCH>`
   - Summarise: what the sync pulled, whether the merge brought in changes, and the Dev theme preview URL.

## Rules

- NEVER push to the live theme — the only push target is `themes.dev` from the manifest.
- NEVER run with a dirty working tree.
- NEVER push to GitHub without asking first.
- Always finish back on `START_BRANCH`, even if a step is aborted.
- Always use UK spelling in output.
