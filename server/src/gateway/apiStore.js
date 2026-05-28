const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

const API_FILE = path.join(__dirname, '../../../data/apis.json');

function load() {
  if (!fs.existsSync(API_FILE)) return { apis: {}, resources: {}, methods: {}, deployments: {}, stages: {} };
  return JSON.parse(fs.readFileSync(API_FILE, 'utf-8'));
}
function save(data) {
  fs.mkdirSync(path.dirname(API_FILE), { recursive: true });
  fs.writeFileSync(API_FILE, JSON.stringify(data, null, 2));
}

function genId() { return uuidv4().replace(/-/g, '').slice(0, 10); }

// ── REST APIs ──
function createApi(name, description) {
  const db = load();
  const api = { id: genId(), name, description: description || '', createdDate: new Date().toISOString() };
  db.apis[api.id] = api;
  // auto-create root resource
  const root = { id: genId(), restApiId: api.id, parentId: null, pathPart: '/', path: '/' };
  db.resources[root.id] = root;
  save(db);
  return { api, rootResourceId: root.id };
}

function listApis() { return Object.values(load().apis); }
function getApi(apiId) { return load().apis[apiId] || null; }
function deleteApi(apiId) {
  const db = load();
  delete db.apis[apiId];
  // clean up all related resources/methods/stages
  Object.keys(db.resources).filter(id => db.resources[id].restApiId === apiId).forEach(id => delete db.resources[id]);
  Object.keys(db.methods).filter(id => db.methods[id].restApiId === apiId).forEach(id => delete db.methods[id]);
  Object.keys(db.stages).filter(id => db.stages[id].restApiId === apiId).forEach(id => delete db.stages[id]);
  save(db);
}

// ── RESOURCES ──
function createResource(restApiId, parentId, pathPart) {
  const db = load();
  const parent = db.resources[parentId];
  if (!parent) throw new Error('Parent resource not found');
  const parentPath = parent.path === '/' ? '' : parent.path;
  const resource = {
    id: genId(), restApiId, parentId,
    pathPart, path: `${parentPath}/${pathPart}`
  };
  db.resources[resource.id] = resource;
  save(db);
  return resource;
}

function listResources(restApiId) { return Object.values(load().resources).filter(r => r.restApiId === restApiId); }
function getResource(resourceId) { return load().resources[resourceId] || null; }

// ── METHODS ──
function putMethod(restApiId, resourceId, httpMethod, config) {
  const db = load();
  const key = `${resourceId}#${httpMethod}`;
  db.methods[key] = { restApiId, resourceId, httpMethod, ...config };
  save(db);
  return db.methods[key];
}

function getMethod(resourceId, httpMethod) {
  const db = load();
  return db.methods[`${resourceId}#${httpMethod}`] || db.methods[`${resourceId}#ANY`] || null;
}

function putIntegration(resourceId, httpMethod, integration) {
  const db = load();
  const key = `${resourceId}#${httpMethod}`;
  if (!db.methods[key]) throw new Error('Method not found');
  db.methods[key].integration = integration;
  save(db);
  return integration;
}

// ── DEPLOYMENTS + STAGES ──
function createDeployment(restApiId, stageName, variables) {
  const db = load();
  const deployment = { id: genId(), restApiId, createdDate: new Date().toISOString() };
  db.deployments[deployment.id] = deployment;
  if (stageName) {
    const stageKey = `${restApiId}#${stageName}`;
    db.stages[stageKey] = { restApiId, stageName, deploymentId: deployment.id, variables: variables || {}, createdDate: new Date().toISOString() };
  }
  save(db);
  return deployment;
}

function listStages(restApiId) {
  return Object.values(load().stages).filter(s => s.restApiId === restApiId);
}

function getStage(restApiId, stageName) {
  return load().stages[`${restApiId}#${stageName}`] || null;
}

module.exports = {
  createApi, listApis, getApi, deleteApi,
  createResource, listResources, getResource,
  putMethod, getMethod, putIntegration,
  createDeployment, listStages, getStage
};