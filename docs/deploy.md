# YNOT Production Deploy Runbook

## Sentry setup

1. Create Sentry account: https://sentry.io/signup/ (free tier, 5k events/month)
2. Create project → "Next.js" platform → name `ynot-london`
3. Copy DSN from Project Settings → Client Keys (DSN); paste into `/etc/ynot/secrets.env`:
   - `SENTRY_DSN=...`
   - `NEXT_PUBLIC_SENTRY_DSN=...`
4. Create auth token: Settings → Account → Auth Tokens → New (scope `project:write`)
5. Add to GitHub repo Secrets as `SENTRY_AUTH_TOKEN` (used by deploy workflow for source maps)

## UptimeRobot setup

1. Create UptimeRobot account: https://uptimerobot.com/signUp (free tier, 50 monitors)
2. Create monitor: HTTP(S), URL `https://ynotlondon.com`, interval 5 min
3. Create monitor: HTTP(S), URL `https://ynotlondon.com/api/health`, interval 5 min, alert when status code != 200
4. Add alert contact: email `alerts@ynotlondon.com`

(Full runbook expanded in later tasks — bootstrap, deploy, rollback, restore.)

## Deploy flow (after Phase 8 lands)

1. Code merged to `main` → GitHub Actions:
   - CI: `pnpm typecheck && lint && test && build`. Must pass.
   - Deploy: builds Docker images, pushes to ghcr.io, SSHs to VPS, pulls, runs `prisma migrate deploy`, `docker compose up -d` for app+worker+caddy.
   - Total: ~5-7 minutes. Health check via `/api/health` confirms success.

2. Manual fallback: `./scripts/prod-deploy-local.sh <git-sha-12-chars>` from operator Mac.

## Rollback

- **Recent breakage:** `git revert <bad-sha> && git push origin main`. Re-runs deploy with previous image (~5 min).
- **Emergency:** `ssh ynot-prod`, `cd /srv/ynot/web`, `IMAGE_TAG=<previous-sha> docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod up -d`. Bypasses migration replay.

## Restore from backup

1. SSH to VPS as `ynot` user.
2. `./scripts/prod-restore-postgres.sh YYYY-MM-DD` — restores Postgres from R2.
3. For media: `aws s3 cp s3://ynot-backups/media/YYYY-MM-DD.tar.gz . --endpoint-url $R2_ENDPOINT && sudo tar -xzf YYYY-MM-DD.tar.gz -C /`.

## Common ops

- View logs: `ssh ynot-prod 'docker compose -f /srv/ynot/web/docker-compose.yml -f /srv/ynot/web/docker-compose.prod.yml logs -f --tail=200 app'`
- Restart all: `ssh ynot-prod 'cd /srv/ynot/web && docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod restart'`
- Connect to Postgres: `ssh ynot-prod 'docker exec -it ynot-postgres psql -U ynot ynot_prod'`
- Worker logs: `ssh ynot-prod 'docker logs --tail=100 ynot-worker'`

## DNS rollback

If Cloudflare proxy breaks something:
1. CF Dashboard → DNS → flip orange cloud to grey for `@` and `www` records (DNS-only, bypasses proxy).
2. If still broken: GoDaddy → Domains → `ynotlondon.com` → Nameservers → revert to default GoDaddy NS values. Propagation 5min – 24h.
