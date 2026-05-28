const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const IAM_FILE = path.join(__dirname, '../../iam.json');

// Default system roles like AWS
const DEFAULT_ROLES = {
  'admin': {
    id: 'admin',
    name: 'Administrator',
    description: 'Full control — create/delete VMs, assign roles',
    permissions: ['*:*'],
    isSystem: true,
    color: '#ff5c5c',
    createdAt: new Date().toISOString()
  },
  'vm-reader': {
    id: 'vm-reader',
    name: 'VM Reader',
    description: 'Read-only access — view VM status and logs',
    permissions: [
      'ec2:read',
      'vpc:read',
      'rds:read',
      'cloudwatch:read',
      's3:read',
      'billing:read'
    ],
    isSystem: true,
    color: '#00d4aa',
    createdAt: new Date().toISOString()
  },
  'vm-contributor': {
    id: 'vm-contributor',
    name: 'VM Contributor',
    description: 'Manage VMs — start/stop/deploy, cannot manage users',
    permissions: [
      'ec2:read', 'ec2:launch', 'ec2:stop',
      'vpc:read', 'vpc:create',
      'rds:read', 'rds:create', 'rds:query',
      's3:read', 's3:write',
      'lambda:invoke', 'lambda:deploy',
      'sqs:read', 'sqs:write',
      'cloudwatch:read'
    ],
    isSystem: true,
    color: '#f7a26a',
    createdAt: new Date().toISOString()
  },
  'developer': {
    id: 'developer',
    name: 'Developer',
    description: 'Access to S3, Lambda, SQS, SNS',
    permissions: [
      's3:read', 's3:write', 's3:delete',
      'lambda:invoke', 'lambda:deploy',
      'sqs:read', 'sqs:write',
      'sns:publish', 'sns:subscribe',
      'secrets:read'
    ],
    isSystem: true,
    color: '#7c6af7',
    createdAt: new Date().toISOString()
  },
  'readonly': {
    id: 'readonly',
    name: 'Read Only',
    description: 'Read-only access to all services',
    permissions: [
      's3:read', 'sqs:read', 'sns:read',
      'ec2:read', 'rds:read', 'vpc:read',
      'secrets:read', 'iam:read',
      'cloudwatch:read', 'billing:read'
    ],
    isSystem: true,
    color: '#6b7280',
    createdAt: new Date().toISOString()
  }
};

// All available permissions
const ALL_PERMISSIONS = {
  's3:read':        'Read S3 buckets and objects',
  's3:write':       'Upload objects to S3',
  's3:delete':      'Delete S3 objects and buckets',
  'lambda:invoke':  'Invoke Lambda functions',
  'lambda:deploy':  'Deploy new Lambda functions',
  'sqs:read':       'Read SQS queues and messages',
  'sqs:write':      'Send messages to SQS queues',
  'sqs:delete':     'Delete SQS queues',
  'sns:publish':    'Publish SNS messages',
  'sns:subscribe':  'Subscribe to SNS topics',
  'sns:read':       'List SNS topics',
  'ec2:read':       'List EC2 instances',
  'ec2:launch':     'Launch EC2 instances',
  'ec2:stop':       'Stop EC2 instances',
  'ec2:terminate':  'Terminate EC2 instances',
  'rds:read':       'List RDS instances',
  'rds:create':     'Create RDS instances',
  'rds:delete':     'Delete RDS instances',
  'rds:query':      'Execute SQL queries',
  'vpc:read':       'List VPCs and subnets',
  'vpc:create':     'Create VPCs and subnets',
  'vpc:delete':     'Delete VPCs',
  'secrets:read':   'Read secrets',
  'secrets:write':  'Create and update secrets',
  'secrets:delete': 'Delete secrets',
  'cloudwatch:read':'View metrics and logs',
  'billing:read':   'View billing information',
  'iam:read':       'View IAM users and roles',
  'iam:admin':      'Full IAM management',
  '*:*':            'Full administrator access'
};

function load() {
  if (!fs.existsSync(IAM_FILE)) {
    return { roles: DEFAULT_ROLES, policies: {} };
  }
  const data = JSON.parse(fs.readFileSync(IAM_FILE, 'utf-8'));
  // Always merge default roles
  data.roles = { ...DEFAULT_ROLES, ...data.roles };
  return data;
}

function save(data) {
  fs.writeFileSync(IAM_FILE, JSON.stringify(data, null, 2));
}

// CREATE custom role
function createRole(name, description, permissions) {
  const data = load();
  const id = name.toLowerCase().replace(/\s+/g, '-');

  if (data.roles[id]) throw new Error(`Role "${id}" already exists`);

  data.roles[id] = {
    id,
    name,
    description,
    permissions,
    isSystem: false,
    createdAt: new Date().toISOString()
  };

  save(data);
  return data.roles[id];
}

// LIST all roles
function listRoles() {
  const data = load();
  return Object.values(data.roles);
}

// GET role
function getRole(id) {
  const data = load();
  if (!data.roles[id]) throw new Error(`Role "${id}" not found`);
  return data.roles[id];
}

// DELETE custom role
function deleteRole(id) {
  const data = load();
  if (!data.roles[id]) throw new Error(`Role "${id}" not found`);
  if (data.roles[id].isSystem) throw new Error(`Cannot delete system role "${id}"`);
  delete data.roles[id];
  save(data);
}

// UPDATE role permissions
function updateRolePermissions(id, permissions) {
  const data = load();
  if (!data.roles[id]) throw new Error(`Role "${id}" not found`);
  if (data.roles[id].isSystem) throw new Error(`Cannot modify system role "${id}"`);
  data.roles[id].permissions = permissions;
  save(data);
  return data.roles[id];
}

// CHECK if user has permission
function hasPermission(userPermissions, requiredPermission) {
  if (!userPermissions || userPermissions.length === 0) return false;

  // Admin has full access
  if (userPermissions.includes('*:*')) return true;
  if (userPermissions.includes('admin')) return true;

  // Check exact permission
  if (userPermissions.includes(requiredPermission)) return true;

  // Check wildcard service permission (e.g. s3:* covers s3:read)
  const [service] = requiredPermission.split(':');
  if (userPermissions.includes(`${service}:*`)) return true;

  return false;
}

// GET permissions list
function getAllPermissions() {
  return ALL_PERMISSIONS;
}

// ADD a custom permission key at runtime
function addPermission(key, description) {
  if (ALL_PERMISSIONS[key]) throw new Error(`Permission "${key}" already exists`);
  ALL_PERMISSIONS[key] = description || '';
}

module.exports = {
  createRole, listRoles, getRole,
  deleteRole, updateRolePermissions,
  hasPermission, getAllPermissions, addPermission,
  DEFAULT_ROLES
};