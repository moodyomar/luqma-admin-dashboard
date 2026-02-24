# Admin dashboard – order notification sounds

Place your audio files in this folder (`public/`) so they are served at the root path. Each app can use different voices; sync/update scripts will not override them if you use one of the options below.

## Default file names (used if env is not set)

| File | When it plays |
|------|----------------|
| **luqma.mp3** | New order arrived (plays immediately). |
| **order-not-accepted-yet.mp3** | New order still not accepted after 2 minutes – reminder. |
| **future-order-due.mp3** | A scheduled (future) order’s time has just become due – “time to prepare”. |

## Keeping different voices per app (sync-safe)

**Option A – Same file names, different files per project**  
- Use the same names in every app (e.g. `order-not-accepted-yet.mp3`, `future-order-due.mp3`).  
- In your **sync or update script**, **do not copy** `public/*.mp3` (or list these files as “preserve”).  
- Each project keeps its own recordings; only code is synced.

**Option B – Config from .env (recommended)**  
- Set these in each project’s `.env` (or Vercel/env). Sync scripts usually do not overwrite `.env`.  
- The app reads paths from env; code stays the same, each app has its own sounds.

```env
# Optional – override per app (paths relative to public, e.g. /my-new-order.mp3)
VITE_NEW_ORDER_SOUND=/luqma.mp3
VITE_ORDER_NOT_ACCEPTED_SOUND=/order-not-accepted-yet.mp3
VITE_FUTURE_ORDER_DUE_SOUND=/future-order-due.mp3
# Optional – delay before “not accepted” reminder (milliseconds, default 120000 = 2 min)
VITE_ORDER_NOT_ACCEPTED_AFTER_MS=120000
```

- If a sound file is missing, the app will try to play it and log a warning; no crash.
