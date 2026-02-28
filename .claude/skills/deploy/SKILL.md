---
name: deploy
description: Push only git-changed files to the live Shopify theme
allowed-tools:
  - Bash
  - AskUserQuestion
---

# Deploy to Live Theme

Push only the files that changed in recent commits to the live Shopify theme.

## Process

1. **Check the working tree**
   - Run `git status` (never use `-uall` flag)
   - If there are uncommitted changes, **warn the user**: "You have uncommitted changes that won't be deployed. Commit first?"
   - Suggest using `/commit` first, then stop and wait for confirmation

2. **Detect the live theme**
   - Run `shopify theme list --role=live --json`
   - Parse the JSON output to extract the theme ID and name
   - Display: "Live theme: **{name}** (ID: {id})"
   - If the command fails or returns no live theme, stop and inform the user

3. **Get changed files**
   - If `$ARGUMENTS` is provided, use it as the commit count: `git diff --name-only HEAD~<N>`
   - If no arguments, default to `git diff --name-only HEAD~1`
   - Filter the file list to only include files within valid Shopify theme directories: `assets/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`, `templates/`
   - Exclude any files outside these directories
   - If no valid theme files changed, tell the user and stop

4. **Warn if too many files**
   - If more than 50 files changed, warn the user: "Over 50 files changed — consider a full `shopify theme push` instead"
   - Ask whether to continue with the selective push or do a full push

5. **Show the deployment plan**
   - List all files that will be pushed
   - Show the total file count
   - Ask the user to confirm before proceeding

6. **Deploy**
   - Build the `--only` flags: one `--only <file>` per changed file
   - Run: `shopify theme push --theme <LIVE_ID> --allow-live --nodelete --only <file1> --only <file2> ...`
   - Wait for the push to complete

7. **Confirm**
   - If successful, display: "Deployed {N} file(s) to **{theme_name}**"
   - If the push fails, show the error output and stop

## Rules

- NEVER push to the live theme without user confirmation
- NEVER omit `--allow-live` or `--nodelete` flags
- NEVER deploy uncommitted changes — only files from git history
- NEVER deploy files outside the valid Shopify theme directories
- Always auto-detect the live theme at runtime — never hardcode a theme ID
- Always use UK spelling in all output (e.g. "colour" not "color", "summarise" not "summarize")
- If `$ARGUMENTS` is a number, treat it as the commit count for `HEAD~N`
