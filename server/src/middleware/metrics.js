const { recordRequest } = require('../metrics/metricsStore');

function metricsMiddleware(req, res, next) {
  const start = Date.now();

  // When response finishes, record the metrics
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    recordRequest(
      req.method,
      req.path,
      res.statusCode,
      responseTime
    );
  });

  next();
}

module.exports = metricsMiddleware;