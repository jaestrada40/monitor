# Deploying MonitorPro to the Hostinger VPS

## One-time server setup

1. Install Node.js (20+), PostgreSQL, Nginx, and PM2 on the VPS.
2. Create the database and user:
   ```bash
   sudo -u postgres createuser monitorpro --pwprompt
   sudo -u postgres createdb monitorpro -O monitorpro
   ```
3. Clone the repo, then in `server/`:
   ```bash
   npm install
   cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, SMTP_*, FRONTEND_ORIGIN
   npm run build
   node dist/migrate.js
   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup
   ```
4. Build the frontend and serve it as static files via Nginx:
   ```bash
   npm install
   VITE_API_BASE=https://your-domain.com/api npm run build
   ```
   Point Nginx's document root at the generated `dist/` folder.
5. Configure Nginx to reverse-proxy `/api/*` to `http://localhost:4000` and serve the frontend `dist/` for everything else. Issue a TLS certificate with Certbot:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

## Redeploys

```bash
git pull
cd server && npm install && npm run build && pm2 restart monitorpro-api
cd .. && npm install && VITE_API_BASE=https://your-domain.com/api npm run build
```
