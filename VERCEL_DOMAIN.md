# Vercel deployment (admin.luqma.co.il)

## Single project: luqma-admin-dashboard

This repo deploys to **one** Vercel project: **luqma-admin-dashboard** (domain **admin.luqma.co.il**).

- **`.vercel/project.json`** is committed so every clone and every deploy uses this project. No duplicate projects are created.
- Do **not** run `vercel link` and choose "Create new project" for this repo. If you need to re-link, use **Link to existing project** → **luqma-admin-dashboard**.

## Env vars (Production & Preview)

- `VITE_FIREBASE_*` (API key, auth domain, project ID, storage bucket, messaging sender ID, app ID)
- `VITE_ADVANCED_SETTINGS_EMAILS` (e.g. `info@qbmedia.co.il,apps@qbmedia.co`)
- `VITE_DEBUG_TOOLS_PASSWORD`

## What was fixed (consolidation)

- There were two projects: **admin-dashboard** (duplicate) and **luqma-admin-dashboard** (the one with admin.luqma.co.il). The duplicate **admin-dashboard** was removed.
- The repo is now linked only to **luqma-admin-dashboard**. All env vars are set there, and **admin.luqma.co.il** shows Advanced Settings for allowlisted users.

## Other client dashboards (risto, icon, safaa, etc.)

For each client there should be **one** Vercel project (e.g. risto-dashboard, icon-dashboard). When setting up or deploying a client dashboard:

1. Run **`vercel link`** in that dashboard’s directory.
2. Choose **Link to existing project** (do **not** create a new project).
3. Select the correct project (e.g. **risto-dashboard** for Risto).
4. Optionally commit **`.vercel/project.json`** in that repo (and add `!.vercel/project.json` before `.vercel` in `.gitignore`) so the link is shared and no duplicate is created.
