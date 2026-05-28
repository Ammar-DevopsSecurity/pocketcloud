const jwt = require('jsonwebtoken');

// Secret key for signing tokens
// In production this would be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'pocketcloud_super_secret_key_2026';
const TOKEN_EXPIRY = '24h';

// Generate a session token after login
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

// Verify a token — returns user info or null
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = { generateToken, verifyToken };