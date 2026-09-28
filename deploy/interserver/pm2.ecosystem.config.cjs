/**
 * PM2 ecosystem for the Voltflow assistant API (InterServer / self-hosted).
 *
 * Start:   pm2 start deploy/interserver/pm2.ecosystem.config.cjs
 * Reload:  pm2 startOrReload deploy/interserver/pm2.ecosystem.config.cjs --update-env
 * Boot:    pm2 startup   (run the printed command)   then:  pm2 save
 *
 * NO SECRETS live here. The ANTHROPIC_API_KEY is loaded by server/index.js from
 * /etc/voltflow/voltflow.env (root-owned, chmod 600) — outside the repo and never
 * in the client bundle. Override the path with VOLTFLOW_ENV_FILE if needed.
 */
module.exports = {
  apps: [
    {
      name: "voltflow-api",
      script: "server/index.js",
      cwd: "/opt/voltflow",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "200M", // comfortable on a 1 GB $3 VPS
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        HOST: "127.0.0.1",
        // VOLTFLOW_ENV_FILE: "/etc/voltflow/voltflow.env", // default; uncomment to override
      },
    },
  ],
};
