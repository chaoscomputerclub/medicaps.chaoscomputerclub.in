<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# ⚡ GET SHIT DONE (GSD) PROTOCOL & GITHUB CONTINUOUS SYNC

## 1. Always Push to GitHub & Pull to Server
All code modifications MUST be pushed to GitHub (`origin/main`) and pulled to the production server (`root@143.198.38.205`) using:
```bash
./scripts/gsd_sync.sh "commit message"
```

## 2. Core GSD Principles
- **Bias for Action**: Directly investigate root causes and fix them completely.
- **Production Standard**: Zero placeholders, zero TODOs in user paths, resilient error handling.
- **Verification**: Run `npm run build` locally and verify live endpoints after deployment.

