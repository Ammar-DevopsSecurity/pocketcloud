const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VPC_FILE = path.join(__dirname, '../../vpc.json');

function load() {
  if (!fs.existsSync(VPC_FILE)) return { vpcs: {}, subnets: {}, securityGroups: {} };
  return JSON.parse(fs.readFileSync(VPC_FILE, 'utf-8'));
}

function save(data) {
  fs.writeFileSync(VPC_FILE, JSON.stringify(data, null, 2));
}

// CREATE VPC
function createVpc(name, cidrBlock, region = 'local-1') {
  const data = load();
  const id = `vpc-${crypto.randomBytes(4).toString('hex')}`;

  data.vpcs[id] = {
    id,
    name,
    cidrBlock,
    region,
    state: 'available',
    isDefault: Object.keys(data.vpcs).length === 0,
    createdAt: new Date().toISOString(),
    subnets: [],
    securityGroups: []
  };

  // Auto create default security group
  const sgId = `sg-${crypto.randomBytes(4).toString('hex')}`;
  data.securityGroups[sgId] = {
    id: sgId,
    vpcId: id,
    name: 'default',
    description: 'Default security group',
    inboundRules: [
      { protocol: 'tcp', fromPort: 22, toPort: 22, source: '0.0.0.0/0', description: 'SSH' },
      { protocol: 'tcp', fromPort: 80, toPort: 80, source: '0.0.0.0/0', description: 'HTTP' },
      { protocol: 'tcp', fromPort: 443, toPort: 443, source: '0.0.0.0/0', description: 'HTTPS' }
    ],
    outboundRules: [
      { protocol: '-1', fromPort: 0, toPort: 0, destination: '0.0.0.0/0', description: 'All traffic' }
    ],
    createdAt: new Date().toISOString()
  };

  data.vpcs[id].securityGroups.push(sgId);
  save(data);
  return { vpc: data.vpcs[id], securityGroup: data.securityGroups[sgId] };
}

// LIST VPCs
function listVpcs() {
  const data = load();
  return Object.values(data.vpcs);
}

// GET VPC
function getVpc(id) {
  const data = load();
  if (!data.vpcs[id]) throw new Error(`VPC "${id}" not found`);
  return data.vpcs[id];
}

// DELETE VPC
function deleteVpc(id) {
  const data = load();
  if (!data.vpcs[id]) throw new Error(`VPC "${id}" not found`);

  // Delete associated subnets
  data.vpcs[id].subnets.forEach(subnetId => {
    delete data.subnets[subnetId];
  });

  // Delete associated security groups
  data.vpcs[id].securityGroups.forEach(sgId => {
    delete data.securityGroups[sgId];
  });

  delete data.vpcs[id];
  save(data);
}

// CREATE Subnet
function createSubnet(vpcId, name, cidrBlock, type = 'public') {
  const data = load();
  if (!data.vpcs[vpcId]) throw new Error(`VPC "${vpcId}" not found`);

  const id = `subnet-${crypto.randomBytes(4).toString('hex')}`;

  data.subnets[id] = {
    id,
    vpcId,
    name,
    cidrBlock,
    type, // public or private
    state: 'available',
    availableIps: 251,
    createdAt: new Date().toISOString()
  };

  data.vpcs[vpcId].subnets.push(id);
  save(data);
  return data.subnets[id];
}

// LIST Subnets for VPC
function listSubnets(vpcId) {
  const data = load();
  return Object.values(data.subnets).filter(s => s.vpcId === vpcId);
}

// LIST Security Groups
function listSecurityGroups(vpcId) {
  const data = load();
  return Object.values(data.securityGroups).filter(sg => sg.vpcId === vpcId);
}

module.exports = {
  createVpc, listVpcs, getVpc, deleteVpc,
  createSubnet, listSubnets, listSecurityGroups
};