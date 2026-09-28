# Voltflow InterServer — Rollback

`deploy.sh` copies the previous frontend to `/var/www/voltflow/dist.bak.<timestamp>`
before each release, so rolling the **frontend** back is a copy away.

## Roll back the frontend
```bash
ls -dt /var/www/voltflow/dist.bak.* | head        # find the most recent backup
sudo rsync -a --delete /var/www/voltflow/dist.bak.YYYYMMDD-HHMMSS/ /var/www/voltflow/dist/
sudo chown -R www-data:www-data /var/www/voltflow/dist
sudo systemctl reload nginx
```

## Roll back the code, then rebuild
```bash
cd /opt/voltflow
git log --oneline -n 10          # or: git tag
git checkout <good-commit-or-tag>
./deploy/interserver/deploy.sh   # rebuild + republish (+ restart API)
```

## Roll back the Node assistant API
```bash
pm2 restart voltflow-api         # restart current
pm2 logs voltflow-api --lines 100
# to stop the API entirely (frontend keeps working via Project Advisor fallback):
pm2 stop voltflow-api
# then remove the /api/ block from the Nginx config and reload, OR leave it —
# the frontend handles a 502 as "assistant not enabled".
```

## Full "back to a clean slate"
```bash
pm2 delete voltflow-api || true
sudo rm -f /etc/nginx/sites-enabled/voltflow
sudo systemctl reload nginx
# the VPS is now serving nothing on this site; Vercel is unaffected either way.
```

## The ultimate rollback
**Vercel is always live.** If anything on the VPS misbehaves, point DNS back at
Vercel (or just use the Vercel URL). InterServer is staging/backup, not the single
point of failure — that is the whole reason to keep Vercel.
