const app = require('./app');
const { runStartupChecks } = require('./config/startupChecks');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Validate critical configuration early (non-fatal warnings).
// Non-fatal: server still starts even if checks fail.
(async () => {
  try {
    await runStartupChecks();
  } catch (err) {
    console.warn(
      `[startup] WARNING: startup checks failed: ${err && err.message ? err.message : String(err)}`
    );
  }
})();

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = server;
