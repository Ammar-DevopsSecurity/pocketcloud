const fs = require('fs');
const path = require('path');

const GATEWAY_FILE = path.join(__dirname, '../../gateway.json');

function loadRoutes() {
  if (!fs.existsSync(GATEWAY_FILE)) return {};
  return JSON.parse(fs.readFileSync(GATEWAY_FILE, 'utf-8'));
}

function saveRoutes(routes) {
  fs.writeFileSync(GATEWAY_FILE, JSON.stringify(routes, null, 2));
}

// CREATE a route
function createRoute(id, config) {
  const routes = loadRoutes();
  if (routes[id]) throw new Error(`Route "${id}" already exists`);

  routes[id] = {
    id,
    path: config.path,           // e.g. /api/users
    target: config.target,       // e.g. http://localhost:3000
    method: config.method || 'ANY',
    rateLimit: config.rateLimit || 100,  // requests per minute
    enabled: true,
    createdAt: new Date().toISOString(),
    hits: 0
  };

  saveRoutes(routes);
  return routes[id];
}

// LIST routes
function listRoutes() {
  return Object.values(loadRoutes());
}

// DELETE route
function deleteRoute(id) {
  const routes = loadRoutes();
  if (!routes[id]) throw new Error(`Route "${id}" not found`);
  delete routes[id];
  saveRoutes(routes);
}

// INCREMENT hit counter
function incrementHits(id) {
  const routes = loadRoutes();
  if (routes[id]) {
    routes[id].hits++;
    saveRoutes(routes);
  }
}

// TOGGLE route
function toggleRoute(id, enabled) {
  const routes = loadRoutes();
  if (!routes[id]) throw new Error(`Route "${id}" not found`);
  routes[id].enabled = enabled;
  saveRoutes(routes);
  return routes[id];
}

module.exports = { createRoute, listRoutes, deleteRoute, incrementHits, toggleRoute };