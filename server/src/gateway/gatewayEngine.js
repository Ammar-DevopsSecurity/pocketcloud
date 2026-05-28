const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const { listRoutes, incrementHits } = require('./gatewayStore');

const router = express.Router();

// This middleware dynamically routes requests
// based on rules stored in gateway.json
function gatewayMiddleware(req, res, next) {
  const routes = listRoutes();

  // Find matching route
  const match = routes.find(route => {
    if (!route.enabled) return false;
    // Check if request path starts with route path
    return req.path.startsWith(route.path) &&
      (route.method === 'ANY' || route.method === req.method);
  });

  if (!match) {
    return res.status(404).json({
      error: 'No gateway route found for this path',
      path: req.path
    });
  }

  // Track hits
  incrementHits(match.id);

  console.log(`🌐 Gateway: ${req.method} ${req.path} → ${match.target}`);

  // Proxy the request to the target
  const proxy = createProxyMiddleware({
    target: match.target,
    changeOrigin: true,
    pathRewrite: { [`^${match.path}`]: '' },
    on: {
      error: (err, req, res) => {
        res.status(502).json({
          error: 'Gateway target unreachable',
          target: match.target,
          detail: err.message
        });
      }
    }
  });

  proxy(req, res, next);
}

module.exports = { gatewayMiddleware };