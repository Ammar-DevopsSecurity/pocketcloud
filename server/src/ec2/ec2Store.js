const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EC2_FILE = path.join(__dirname, '../../ec2.json');

// Instance type definitions
const INSTANCE_TYPES = {
  't2.nano':   { cpu: 0.25, memoryMB: 256,  description: 'Nano - 256MB RAM' },
  't2.micro':  { cpu: 0.5,  memoryMB: 512,  description: 'Micro - 512MB RAM' },
  't2.small':  { cpu: 1,    memoryMB: 1024, description: 'Small - 1GB RAM' },
  't2.medium': { cpu: 2,    memoryMB: 2048, description: 'Medium - 2GB RAM' },
  't2.large':  { cpu: 2,    memoryMB: 4096, description: 'Large - 4GB RAM' }
};

function load() {
  if (!fs.existsSync(EC2_FILE)) return { instances: {} };
  return JSON.parse(fs.readFileSync(EC2_FILE, 'utf-8'));
}

function save(data) {
  fs.writeFileSync(EC2_FILE, JSON.stringify(data, null, 2));
}

function createInstance(config) {
  const data = load();
  const id = `i-${crypto.randomBytes(8).toString('hex')}`;
  const instanceType = INSTANCE_TYPES[config.instanceType] || INSTANCE_TYPES['t2.micro'];

  data.instances[id] = {
    id,
    name: config.name,
    instanceType: config.instanceType || 't2.micro',
    ami: config.ami || 'ami-pocketcloud-ubuntu',
    vpcId: config.vpcId,
    subnetId: config.subnetId,
    privateIp: generatePrivateIp(),
    publicIp: null,
    state: 'pending',
    containerId: null,
    cpu: instanceType.cpu,
    memoryMB: instanceType.memoryMB,
    keyPair: config.keyPair || null,
    userData: config.userData || '',
    createdAt: new Date().toISOString(),
    launchTime: null,
    stateHistory: [
      { state: 'pending', timestamp: new Date().toISOString() }
    ]
  };

  save(data);
  return data.instances[id];
}

function updateInstance(id, updates) {
  const data = load();
  if (!data.instances[id]) throw new Error(`Instance "${id}" not found`);
  data.instances[id] = { ...data.instances[id], ...updates };
  save(data);
  return data.instances[id];
}

function getInstance(id) {
  const data = load();
  if (!data.instances[id]) throw new Error(`Instance "${id}" not found`);
  return data.instances[id];
}

function listInstances(vpcId) {
  const data = load();
  const instances = Object.values(data.instances);
  return vpcId ? instances.filter(i => i.vpcId === vpcId) : instances;
}

function deleteInstance(id) {
  const data = load();
  if (!data.instances[id]) throw new Error(`Instance "${id}" not found`);
  delete data.instances[id];
  save(data);
}

function generatePrivateIp() {
  return `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`;
}

function getInstanceTypes() {
  return Object.entries(INSTANCE_TYPES).map(([type, specs]) => ({
    type, ...specs
  }));
}

module.exports = {
  createInstance, updateInstance, getInstance,
  listInstances, deleteInstance, getInstanceTypes, INSTANCE_TYPES
};