---
name: copy-dev-url
description: Build a shareable client preview URL for the Promise Co - Dev theme and copy it to the clipboard, deep-linking to the page relevant to the current work (default homepage)
allowed-tools:
  - Bash
  - AskUserQuestion
  - Read
---

# Copy Dev Preview URL

Produce a client-shareable preview link for the **Promise Co - Dev** theme and copy it to the clipboard with `pbcopy`.

The Dev theme is resolved via `.claude/themes.json` → `themes.dev` (never hardcode an ID).

## Process

1. **Resolve the Dev theme**
   - Read `.claude/themes.json` → `themes.dev` and resolve per its detector (`type: "id"` → match against `shopify theme list --json`). If the theme no longer exists, stop and say so.

2. **Choose the page path**
   - If `$ARGUMENTS` contains a store-relative path (e.g. `/products/x`, `/collections/gold`, `/pages/about`), use it.
   - Otherwise infer from conversation context — link to the page most relevant to what has just been worked on. Examples:
     - Footer / header / site-wide work → homepage `/`
     - Product page work (sticky ATC, buy buttons, product templates) → a representative product page; find a real handle via `shopify theme list`-adjacent context or ask
     - Collection work → that collection
   - If no context at all, default to the homepage `/`.
   - If a specific product/collection is needed but the handle is unknown, ask the user rather than guessing.

3. **Build and copy the URL**
   - Format: `https://thepromiseco.com<path>?preview_theme_id=<ID>` (path `/` → no trailing path)
   - Copy with: `printf '%s' "<URL>" | pbcopy`
   - Print the URL and confirm it is on the clipboard.
   - Remind: preview links expire per-session after roughly 14 days, and show the theme as it currently is — push first (`/push-to-dev`) if the latest work isn't on the theme yet.

## Rules

- Never link to the live theme or an admin URL — this is a client-facing link.
- Always use UK spelling in output.
