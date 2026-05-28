const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, '../../users.json');

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// CREATE a user
async function createUser(username, password, role = 'user', permissions = []) {
  const users = loadUsers();

  if (users[username]) {
    throw new Error(`User "${username}" already exists`);
  }

  // Hash password — never store plain text
  const hashedPassword = await bcrypt.hash(password, 10);

  users[username] = {
    id: crypto.randomBytes(8).toString('hex'),
    username,
    password: hashedPassword,
    role,  // 'admin' or 'user'
    permissions,  // ['s3:read', 's3:write', 'queues:read', etc]
    createdAt: new Date().toISOString(),
    lastLogin: null
  };

  saveUsers(users);

  // Return without password
  const { password: _, ...safeUser } = users[username];
  return safeUser;
}

// VALIDATE login
async function validateUser(username, password) {
  const users = loadUsers();
  const user = users[username];

  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  // Update last login
  users[username].lastLogin = new Date().toISOString();
  saveUsers(users);

  const { password: _, ...safeUser } = user;
  return safeUser;
}

// LIST users (no passwords)
function listUsers() {
  const users = loadUsers();
  return Object.values(users).map(({ password, ...safe }) => safe);
}

// DELETE user
function deleteUser(username) {
  const users = loadUsers();
  if (!users[username]) throw new Error(`User "${username}" not found`);
  delete users[username];
  saveUsers(users);
}

// UPDATE permissions
function updatePermissions(username, permissions) {
  const users = loadUsers();
  if (!users[username]) throw new Error(`User "${username}" not found`);
  users[username].permissions = permissions;
  saveUsers(users);
  const { password, ...safe } = users[username];
  return safe;
}

// Check if any users exist
function hasUsers() {
  const users = loadUsers();
  return Object.keys(users).length > 0;
}

module.exports = {
  createUser,
  validateUser,
  listUsers,
  deleteUser,
  updatePermissions,
  hasUsers
};