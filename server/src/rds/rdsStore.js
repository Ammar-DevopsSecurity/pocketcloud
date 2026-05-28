const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RDS_FILE = path.join(__dirname, '../../rds.json');

function load() {
  if (!fs.existsSync(RDS_FILE)) return { instances: {} };
  return JSON.parse(fs.readFileSync(RDS_FILE, 'utf-8'));
}

function save(data) {
  fs.writeFileSync(RDS_FILE, JSON.stringify(data, null, 2));
}

// CREATE instance record
function createInstance(id, config) {
  const data = load();

  data.instances[id] = {
    id,
    dbName: config.dbName,
    username: config.username,
    password: config.password,
    port: config.port,
    status: 'creating',
    containerId: null,
    createdAt: new Date().toISOString(),
    endpoint: `localhost:${config.port}`
  };

  save(data);
  return data.instances[id];
}

// UPDATE instance
function updateInstance(id, updates) {
  const data = load();
  if (!data.instances[id]) throw new Error(`Instance "${id}" not found`);
  data.instances[id] = { ...data.instances[id], ...updates };
  save(data);
  return data.instances[id];
}

// LIST instances
function listInstances() {
  return Object.values(load().instances);
}

// GET instance
function getInstance(id) {
  const data = load();
  if (!data.instances[id]) throw new Error(`Instance "${id}" not found`);
  return data.instances[id];
}

// DELETE instance
function deleteInstance(id) {
  const data = load();
  if (!data.instances[id]) throw new Error(`Instance "${id}" not found`);
  delete data.instances[id];
  save(data);
}

module.exports = { createInstance, updateInstance, listInstances, getInstance, deleteInstance };