---
name: dev
description: Spin up a hot-reload local Shopify theme dev server against a preview theme target, so saving a file shows up at http://127.0.0.1:9292 instantly
allowed-tools:
  - Bash
  - Read
---

# Local Theme Dev Server

Run `shopify theme dev` so the working tree streams to a local preview at `http://127.0.0.1:9292`. Saving a `.liquid`, `.css`, or `.js` file hot-reloads the local preview — no `theme push` needed. The remote theme is untouched until `/preview` or `/deploy` is run.

## Process

1. **Parse the target from `$ARGUMENTS`**
   - First token may be a target name from `.claude/themes.json` (e.g. `colab`, `preview`)
   - Default to `colab` (the most common dev target for ongoing feature work)
   - Examples:
     - `/dev` → target `colab`
     - `/dev preview` → target `preview` (SEO preview theme)
     - `/dev colab` → explicit colab

2. **Read the themes manifest**
   - Read `.claude/themes.json`
   - Look up `themes.<target>`
   - If missing, stop with a clear error and list available targets (excluding `live`)

3. **Resolve the target theme**
   - Honour the entry's `detect`:
     - `type: "role"` → `shopify theme list --role=<value> --json`
     - `type: "name_contains"` → `shopify theme list --json` filtered case-insensitively
   - If 0 themes match, stop with: "No <target> theme found matching '<value>'."
   - If >1 match, list them and stop.
   - Display: "Target: **<target>** → **{name}** (ID: {id})"

4. **Safety: refuse if the resolved theme is the live theme**
   - Run `shopify theme list --role=live --json` separately
   - If IDs match, **STOP** — `theme dev` against live would push every save straight to production

5. **Confirm branch matches the manifest entry's `branch`**
   - `git branch --show-current`
   - If it doesn't match, warn and ask before proceeding. Dev still works on a wrong branch, but hot-reloaded files won't be what the merchant expects when they later push.

6. **Start the dev server**
   - Run in the foreground so the user can `Ctrl-C` to stop:
     ```sh
     shopify theme dev --theme <THEME_ID> --store thepromiseringco.myshopify.com
     ```
   - The CLI prints the local URL (typically `http://127.0.0.1:9292`) and watches the working tree.

7. **Print useful URLs alongside the CLI output**
   - Homepage: `http://127.0.0.1:9292/`
   - For `colab` target, also print: `http://127.0.0.1:9292/products/promise-heart-solitaire-ring-co-lab-test`
   - For `preview` target, also print:
     - `http://127.0.0.1:9292/collections/gold`
     - `http://127.0.0.1:9292/collections/silver`

## Rules

- NEVER run `shopify theme dev` against the live theme — it would proxy local edits directly to production.
- ALWAYS verify via the manifest + runtime detection; never hardcode IDs.
- The dev server uses the local working tree — uncommitted changes ARE served. That's the point. Just be aware before sharing the URL externally (it's localhost only by default; `--tunnel` flag can expose, but this skill does not enable that).
- Default target is `colab` because that's the active development target. Other targets must be explicit.
- Always use UK spelling in output.
