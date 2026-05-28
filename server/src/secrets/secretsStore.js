const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SECRETS_FILE = path.join(__dirname, '../../secrets.json');

// Encryption key — in production this would be in environment variables
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(process.env.ENCRYPTION_KEY || 'pocketcloud-secrets-key-2026')
  .digest('hex')
  .slice(0, 32);

const ALGORITHM = 'aes-256-cbc';

// ENCRYPT a value
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    iv: iv.toString('hex'),
    value: encrypted
  };
}

// DECRYPT a value
function decrypt(encrypted) {
  const iv = Buffer.from(encrypted.iv, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted.value, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function load() {
  if (!fs.existsSync(SECRETS_FILE)) return {};
  return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8'));
}

function save(data) {
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(data, null, 2));
}

// CREATE or UPDATE a secret
function putSecret(name, value, description = '') {
  const secrets = load();

  const encrypted = encrypt(value);

  secrets[name] = {
    name,
    description,
    encrypted,
    createdAt: secrets[name]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Version tracking like real AWS
    version: (secrets[name]?.version || 0) + 1
  };

  save(secrets);

  return {
    name,
    description,
    version: secrets[name].version,
    createdAt: secrets[name].createdAt,
    updatedAt: secrets[name].updatedAt
  };
}

// GET a secret value (decrypted)
function getSecret(name) {
  const secrets = load();
  const secret = secrets[name];
  if (!secret) throw new Error(`Secret "${name}" not found`);

  return {
    name: secret.name,
    description: secret.description,
    value: decrypt(secret.encrypted), // decrypted value
    version: secret.version,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt
  };
}

// LIST secrets (NO values — just metadata)
function listSecrets() {
  const secrets = load();
  return Object.values(secrets).map(s => ({
    name: s.name,
    description: s.description,
    version: s.version,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt
    // NOTE: value is intentionally excluded
  }));
}

// DELETE a secret
function deleteSecret(name) {
  const secrets = load();
  if (!secrets[name]) throw new Error(`Secret "${name}" not found`);
  delete secrets[name];
  save(secrets);
}

// ROTATE a secret — updates value, bumps version
function rotateSecret(name, newValue) {
  const secrets = load();
  if (!secrets[name]) throw new Error(`Secret "${name}" not found`);

  secrets[name].encrypted = encrypt(newValue);
  secrets[name].version++;
  secrets[name].updatedAt = new Date().toISOString();

  save(secrets);
  return { name, version: secrets[name].version, rotatedAt: secrets[name].updatedAt };
}

module.exports = {
  putSecret,
  getSecret,
  listSecrets,
  deleteSecret,
  rotateSecret
};