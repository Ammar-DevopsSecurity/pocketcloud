const http = require('http');
const https = require('https');

async function dispatch(integration, context) {
  switch (integration.type) {

    case 'MOCK':
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '{"message":"mock response"}' };

    case 'HTTP':
    case 'HTTP_PROXY': {
      const url = new URL(integration.uri);
      // forward path params into URL
      let targetPath = url.pathname;
      Object.entries(context.pathParams || {}).forEach(([k, v]) => {
        targetPath = targetPath.replace(`{${k}}`, v);
      });
      const qs = new URLSearchParams(context.queryParams || {}).toString();
      const fullPath = qs ? `${targetPath}?${qs}` : targetPath;
      return proxyHttp(url.protocol === 'https:' ? https : http, {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: fullPath,
        method: context.method,
        headers: { ...context.headers, host: url.hostname }
      }, context.body);
    }

    case 'AWS':
    case 'AWS_PROXY': {
      // Lambda integration — calls your existing Docker runner
      if (integration.uri && integration.uri.includes('lambda')) {
        const fnMatch = integration.uri.match(/functions\/([^/]+)\/invocations/);
        const fnName = fnMatch ? fnMatch[1].split(':').pop() : null;
        if (!fnName) throw new Error('Cannot parse function name from URI');

        const event = {
          version: '1.0',
          httpMethod: context.method,
          path: context.path,
          pathParameters: context.pathParams || null,
          queryStringParameters: context.queryParams || null,
          headers: context.headers,
          body: typeof context.body === 'object' ? JSON.stringify(context.body) : (context.body || null),
          isBase64Encoded: false,
          stageVariables: context.stageVariables || null
        };

        const result = await proxyHttp(http, {
          hostname: 'localhost',
          port: 4566,
          path: `/functions/${encodeURIComponent(fnName)}/invoke`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, JSON.stringify(event));

        try {
          const payload = JSON.parse(result.body);
          return { statusCode: payload.statusCode || 200, headers: payload.headers || {}, body: payload.body || '' };
        } catch {
          return result;
        }
      }
      throw new Error(`Unsupported AWS URI: ${integration.uri}`);
    }

    default:
      throw new Error(`Unknown integration type: ${integration.type}`);
  }
}

function proxyHttp(transport, options, body) {
  return new Promise((resolve, reject) => {
    const req = transport.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: data
      }));
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

module.exports = { dispatch };