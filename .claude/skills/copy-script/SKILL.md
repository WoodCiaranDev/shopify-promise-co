---
name: copy-script
description: Copy a Google Apps Script from docs/ to the clipboard with real credentials injected from .env. Use when the user needs to deploy or paste one of the docs/*.gs scripts (e.g. promise wall submission handler, CSV export) into Google Apps Script.
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

# Copy Script

The repo stores Google Apps Script files in `docs/*.gs` with **placeholder** credentials so no secrets are committed. The real values live in `.env` (gitignored). This skill fills the placeholders and copies the ready-to-paste script to the macOS clipboard.

## Placeholders → .env keys

| Placeholder in `.gs` | `.env` key |
|----------------------|------------|
| `__SHOPIFY_SHOP_DOMAIN__` | `SHOPIFY_SHOP_DOMAIN` |
| `__SHOPIFY_ADMIN_TOKEN__` | `SHOPIFY_ADMIN_TOKEN` |
| `__MAPBOX_TOKEN__` | `MAPBOX_TOKEN` |

## Process

1. **Pick the script.** If the user named one (e.g. via `$ARGUMENTS`), match it against `docs/*.gs`. Otherwise run `ls docs/*.gs` and ask the user which one with AskUserQuestion.

2. **Read `.env`** to get the credential values. If `.env` is missing or a needed key is blank, stop and tell the user which key to add.

3. **Inject and copy to clipboard.** Substitute every placeholder with its `.env` value and pipe the result straight to `pbcopy` - do NOT write the filled script to disk (that would leave the token in an untracked file). Use a single command so the secret never lands in a temp file, e.g.:

   ```bash
   set -a; . ./.env; set +a
   sed -e "s|__SHOPIFY_SHOP_DOMAIN__|$SHOPIFY_SHOP_DOMAIN|g" \
       -e "s|__SHOPIFY_ADMIN_TOKEN__|$SHOPIFY_ADMIN_TOKEN|g" \
       -e "s|__MAPBOX_TOKEN__|$MAPBOX_TOKEN|g" \
       docs/<chosen>.gs | pbcopy
   ```

4. **Confirm.** Tell the user the filled script is on their clipboard and ready to paste into the Google Apps Script editor. Verify no `__...__` placeholders remain (e.g. `pbpaste | grep -c '__[A-Z_]*__'` should be 0). Never print the token value back to the chat.

## Notes

- This skill only reads `.env` and writes to the clipboard; it never modifies the `docs/*.gs` files or commits anything.
- If a script gains a new placeholder, add a matching row to the table above and a `-e` substitution.
