const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const KEYS_FILE = path.join(__dirname, '../../data/keys.json');
// Safe JSON loader (prevents crashes)
function loadKeys() {
  try {
    if (!fs.existsSync(KEYS_FILE)) return {};
    const raw = fs.readFileSync(KEYS_FILE, 'utf-8');

    if (!raw.trim()) return {};

    const parsed = JSON.parse(raw);

    // Ensure object format
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('❌ Failed to load keys.json:', err.message);
    return {};
  }
}

// Safe writer
function saveKeys(keys) {
  try {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
  } catch (err) {
    console.error('❌ Failed to save keys.json:', err.message);
  }
}

// Generate API key
function generateKey(name) {
  const keys = loadKeys();

  const exists = Object.values(keys).find(k => k.name === name);
  if (exists) throw new Error(`Key with name "${name}" already exists`);

  const keyValue = `pc_live_${crypto.randomBytes(16).toString('hex')}`;
  const id = crypto.randomBytes(8).toString('hex');

  const newKey = {
    id,
    name,
    key: keyValue,
    createdAt: new Date().toISOString(),
    lastUsed: null
  };

  keys[id] = newKey;
  saveKeys(keys);

  return newKey;
}

// Validate API key (FIXED + SAFE)
function validateKey(keyValue) {
  if (!keyValue) return null;

  const keys = loadKeys();

  const foundEntry = Object.values(keys).find(k => k.key === keyValue);

  if (!foundEntry) {
    console.log('❌ Invalid API key attempt:', keyValue);
    return null;
  }

  // Update last used safely (avoid mutation bugs)
  const updatedEntry = {
    ...foundEntry,
    lastUsed: new Date().toISOString()
  };

  keys[updatedEntry.id] = updatedEntry;
  saveKeys(keys);

  return updatedEntry;
}

// List keys (safe preview)
function listKeys() {
  const keys = loadKeys();

  return Object.values(keys).map(k => ({
    id: k.id,
    name: k.name,
    keyPreview: k.key
      ? `${k.key.slice(0, 10)}****${k.key.slice(-6)}`
      : null,
    createdAt: k.createdAt,
    lastUsed: k.lastUsed
  }));
}

// Delete key
function deleteKey(id) {
  const keys = loadKeys();

  if (!keys[id]) {
    throw new Error(`Key "${id}" not found`);
  }

  delete keys[id];
  saveKeys(keys);
}

module.exports = {
  generateKey,
  validateKey,
  listKeys,
  deleteKey
};