const { recordUsage } = require('./billingStore');

function billingMiddleware(req, res, next) {
  // Map routes to billable services
  const path = req.path;
  const method = req.method;

  res.on('finish', () => {
    // Only charge successful requests
    if (res.statusCode >= 400) return;

    try {
      if (path.startsWith('/buckets') && method === 'PUT') {
        recordUsage('s3', 'put', 1, { path });
      } else if (path.startsWith('/buckets') && method === 'GET') {
        recordUsage('s3', 'get', 1, { path });
      } else if (path.startsWith('/buckets') && method === 'DELETE') {
        recordUsage('s3', 'delete', 1, { path });
      } else if (path.startsWith('/queues') && method === 'POST') {
        recordUsage('sqs', 'request', 1, { path });
      } else if (path.startsWith('/queues') && method === 'GET') {
        recordUsage('sqs', 'request', 1, { path });
      } else if (path.startsWith('/sns') && method === 'POST' && path.includes('publish')) {
        recordUsage('sns', 'publish', 1, { path });
      } else if (path.startsWith('/secrets')) {
        recordUsage('secrets', 'api', 1, { path });
      } else if (path.startsWith('/functions') && method === 'POST' && path.includes('invoke')) {
        recordUsage('lambda', 'invoke', 1, { path });
      }
    } catch (err) {
      // Never let billing errors break the app
      console.error('Billing error:', err.message);
    }
  });

  next();
}

module.exports = billingMiddleware;