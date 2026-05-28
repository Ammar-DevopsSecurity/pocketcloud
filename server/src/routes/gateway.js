const express = require('express');
const router = express.Router();
const store = require('../gateway/gatewayStore');
const apiStore = require('../gateway/apiStore');
const { dispatch } = require('../gateway/integrations');

// ─── PROXY ROUTES ───
router.get('/routes', (req, res) => {
  try {
    res.json({ routes: store.listRoutes() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/routes', (req, res) => {
  try {
    const { id, path, target, method, rateLimit } = req.body;
    if (!id || !path || !target) {
      return res.status(400).json({ error: 'id, path and target required' });
    }
    const route = store.createRoute(id, { path, target, method, rateLimit });
    res.status(201).json({ message: 'Route created', route });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/routes/:id', (req, res) => {
  try {
    store.deleteRoute(req.params.id);
    res.json({ message: `Route "${req.params.id}" deleted` });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.patch('/routes/:id/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    const route = store.toggleRoute(req.params.id, enabled);
    res.json({ message: 'Route updated', route });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ─── REST APIs ───
router.post('/restapis', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const { api, rootResourceId } = apiStore.createApi(name, description);
  res.status(201).json({ ...api, rootResourceId });
});

router.get('/restapis', (req, res) => {
  res.json({ items: apiStore.listApis() });
});

router.get('/restapis/:apiId', (req, res) => {
  const api = apiStore.getApi(req.params.apiId);
  if (!api) return res.status(404).json({ error: 'API not found' });
  res.json(api);
});

router.delete('/restapis/:apiId', (req, res) => {
  apiStore.deleteApi(req.params.apiId);
  res.status(204).send();
});

// ─── RESOURCES ───
router.get('/restapis/:apiId/resources', (req, res) => {
  res.json({ items: apiStore.listResources(req.params.apiId) });
});

router.post('/restapis/:apiId/resources/:parentId', (req, res) => {
  try {
    const resource = apiStore.createResource(req.params.apiId, req.params.parentId, req.body.pathPart);
    res.status(201).json(resource);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── METHODS ───
router.put('/restapis/:apiId/resources/:resourceId/methods/:httpMethod', (req, res) => {
  try {
    const method = apiStore.putMethod(
      req.params.apiId,
      req.params.resourceId,
      req.params.httpMethod.toUpperCase(),
      {
        authorizationType: req.body.authorizationType || 'NONE',
        apiKeyRequired: req.body.apiKeyRequired || false
      }
    );
    res.status(201).json(method);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/restapis/:apiId/resources/:resourceId/methods/:httpMethod/integration', (req, res) => {
  try {
    const integration = apiStore.putIntegration(
      req.params.resourceId,
      req.params.httpMethod.toUpperCase(),
      req.body
    );
    res.status(201).json(integration);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── DEPLOYMENTS + STAGES ───
router.post('/restapis/:apiId/deployments', (req, res) => {
  try {
    const deployment = apiStore.createDeployment(
      req.params.apiId,
      req.body.stageName,
      req.body.variables
    );
    res.status(201).json(deployment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/restapis/:apiId/stages', (req, res) => {
  res.json({ items: apiStore.listStages(req.params.apiId) });
});

// ─── EXECUTE (invoke) ───
async function handleExecute(req, res) {
  const { apiId, stage, p1, p2, p3, p4 } = req.params;
  const parts = [p1, p2, p3, p4].filter(Boolean);
  const incomingPath = '/' + parts.join('/');
  const httpMethod = req.method.toUpperCase();

  const api = apiStore.getApi(apiId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const stageObj = apiStore.getStage(apiId, stage);
  if (!stageObj) return res.status(404).json({ error: 'Stage not found' });

  const resources = apiStore.listResources(apiId).filter(r => r.path !== '/');
  const sorted = resources.sort((a, b) =>
    (a.path.match(/\{/g) || []).length - (b.path.match(/\{/g) || []).length
  );

  let matchedResource = null, pathParams = {};
  for (const resource of sorted) {
    const pattern = resource.path.replace(/\{[^}]+\}/g, '([^/]+)');
    const paramNames = (resource.path.match(/\{([^}]+)\}/g) || []).map(p => p.slice(1, -1));
    const match = incomingPath.match(new RegExp(`^${pattern}$`));
    if (match) {
      matchedResource = resource;
      paramNames.forEach((name, i) => { pathParams[name] = match[i + 1]; });
      break;
    }
  }

  if (!matchedResource) return res.status(404).json({ error: 'Resource not found' });

  const method = apiStore.getMethod(matchedResource.id, httpMethod);
  if (!method) return res.status(405).json({ error: 'Method not allowed' });
  if (!method.integration) return res.status(500).json({ error: 'No integration configured' });

  try {
    const result = await dispatch(method.integration, {
      method: httpMethod,
      path: incomingPath,
      pathParams,
      queryParams: req.query,
      headers: req.headers,
      body: req.body,
      stageVariables: stageObj.variables
    });
    res.status(result.statusCode || 200).set(result.headers || {}).send(result.body);
  } catch (err) {
    res.status(502).json({ error: 'Integration error', detail: err.message });
  }
}

router.all('/execute/:apiId/:stage/:p1/:p2/:p3/:p4', handleExecute);
router.all('/execute/:apiId/:stage/:p1/:p2/:p3', handleExecute);
router.all('/execute/:apiId/:stage/:p1/:p2', handleExecute);
router.all('/execute/:apiId/:stage/:p1', handleExecute);
router.all('/execute/:apiId/:stage', handleExecute);

module.exports = router;