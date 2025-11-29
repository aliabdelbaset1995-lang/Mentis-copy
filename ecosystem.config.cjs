module.exports = {
  apps: [
    {
      name: 'isef-server',
      script: 'npm',
      args: 'run server',
      env: {
        NODE_ENV: 'production'
      },
      cwd: __dirname,
      watch: false
    },
    {
      name: 'isef-frontend',
      script: 'npm',
      args: 'run preview',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '5173'
      },
      cwd: __dirname,
      watch: false
    }
  ]
};
