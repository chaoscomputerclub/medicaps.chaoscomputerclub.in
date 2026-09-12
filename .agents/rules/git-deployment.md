# Git-Based Deployment & Version Control Policy

## STRICT RULE: NEVER USE RSYNC FOR DEPLOYMENTS OR FILE TRANSFERS

1. **Zero Rsync Usage**:
   - **NEVER** use `rsync` to copy local working directories, build outputs (`.output/`), or server files directly to remote servers/droplets.
   - `rsync` creates untracked drift between local workstations and servers, obscuring change history and making debugging regressions extremely difficult.

2. **Git as the Single Source of Truth**:
   - Every change (features, bug fixes, styles, configurations, schema updates) **must** be committed and pushed to the GitHub repository.
   - All deployments to production/staging servers **must** pull directly from Git (`git pull origin main`).

3. **Standard Deployment Protocol**:
   1. Stage and commit changes cleanly: `git add . && git commit -m "<semantic message>"`
   2. Push to GitHub: `git push origin main`
   3. On the target server, pull and build:
      ```bash
      git pull origin main
      npm install (or pip install)
      npm run build
      pm2 restart <app>
      ```
