# Project conventions

## Git / deployment

- `main` → Vercel **production** deployment. Never push to `main` unless the user explicitly asks to ship.
- `dev` → Vercel **preview** deployment. Default working branch — do all work and pushes here.
- To ship: `git checkout main && git merge dev && git push`, then switch back to `dev`.
- Frontend deploys to Vercel; backend (`server/`) deploys to Railway.
