const { validateKey } = require('../auth/keyStore');
const { verifyToken } = require('../auth/tokenStore');

const PUBLIC_PATHS = [
  '/health',
  '/keys',
  '/auth',
];

function authMiddleware(req, res, next) {
  // allow static files
  if (
    req.path === '/' ||
    req.path.endsWith('.html') ||
    req.path.endsWith('.css') ||
    req.path.endsWith('.js')
  ) {
    return next();
  }

  // public routes
  if (PUBLIC_PATHS.some(p => req.path.startsWith(p))) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  const keyInfo = validateKey(apiKey);
  if (keyInfo) {
    req.apiKey = keyInfo;
    return next();
  }

  const decoded = verifyToken(apiKey);
  if (decoded) {
    req.apiKey = decoded;
    return next();
  }

  return res.status(401).json({ error: 'Invalid API key' });
}

module.exports = authMiddleware;