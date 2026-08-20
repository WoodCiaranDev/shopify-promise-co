# Promise Co — Shopify Theme

## Project

This is a Shopify theme repository for Promise Co. The repo is cloned from `git@github.com:WoodCiaranDev/shopify-promise-co.git`.

## Shopify CLI

- Always auto-detect the live theme at runtime using `shopify theme list --role=live --json` — never hardcode a theme ID
- The client frequently changes which theme is live, so detection must happen fresh each time

## Theme directories

Valid Shopify theme directories in this repo:

- `assets/`
- `config/`
- `layout/`
- `locales/`
- `sections/`
- `snippets/`
- `templates/`

## Project skills

| Skill | Description |
|-------|-------------|
| `/sync` | Pull the live theme from Shopify, commit as "Client changes", optionally push to GitHub |
| `/deploy` | Push only git-changed files to the live Shopify theme |
| `/commit` | Assess the working tree, group changes into clean logical commits |
| `/merge` | Merge a feature branch into a target using `--no-ff` merge commits |
| `/update-dev` | Sync client changes into `main`, merge into `dev`, push to the Promise Co - Dev theme |
| `/push-to-dev` | Merge the current feature branch into `dev` and push changed files to the Promise Co - Dev theme |
| `/copy-dev-url` | Copy a client-shareable Dev theme preview URL to the clipboard, deep-linked to the relevant page |

## Conventions

- Always use UK spelling (e.g. "colour", "normalise", "centre", "behaviour")
- Never stage `.env`, `.claude/`, or credentials
- Never push to remote without asking first
