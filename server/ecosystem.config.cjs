module.exports = {
  apps: [
    {
      name: 'monitorpro-api',
      cwd: __dirname,
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
