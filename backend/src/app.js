const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');
const { errorHandler, requestLogger, createRateLimiter } = require('./middleware');
const { NotFoundError } = require('./errors/AppError');

// Initialize express app
const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.set('trust proxy', true);

// Request logging should be early so we capture all requests (including errors).
app.use(requestLogger());

app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const host = req.get('host');           // may or may not include port
  let protocol = req.protocol;          // http or https

  const actualPort = req.socket.localPort;
  const hasPort = host.includes(':');
  
  const needsPort =
    !hasPort &&
    ((protocol === 'http' && actualPort !== 80) ||
     (protocol === 'https' && actualPort !== 443));
  const fullHost = needsPort ? `${host}:${actualPort}` : host;
  protocol = req.secure ? 'https' : protocol;

  const dynamicSpec = {
    ...swaggerSpec,
    servers: [
      {
        url: `${protocol}://${fullHost}`,
      },
    ],
  };
  swaggerUi.setup(dynamicSpec)(req, res, next);
});

// Parse JSON request body
app.use(express.json());

// Rate limit all routes except /api/health (explicitly excluded).
// Keep this before routes so it also protects endpoints prior to auth verification.
app.use(
  createRateLimiter({
    limit: 100,
    windowMs: 15 * 60 * 1000,
    skip: (req) => req.path === '/api/health',
  })
);

// Mount routes
app.use('/', routes);

// 404 handler (must come after all routes)
app.use((req, res, next) => {
  return next(
    new NotFoundError('Route not found.', {
      method: req.method,
      path: req.originalUrl,
    })
  );
});

// Centralized error handler (must be last)
app.use(errorHandler);

module.exports = app;
