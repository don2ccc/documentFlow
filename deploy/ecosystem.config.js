module.exports = {
  apps: [
    {
      name: 'documentflow-api',
      script: 'apps/server/dist/src/main.js',
      cwd: '/opt/documentflow',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production', PORT: '3000' }
    },
    {
      name: 'documentflow-worker',
      script: 'apps/server/dist/src/main-worker.js',
      cwd: '/opt/documentflow',
      autorestart: true,
      env: { NODE_ENV: 'production' }
    }
  ]
};
