const express = require('express');
const router = express.Router();
const iamStore = require('../iam/iamStore'); // adjust path if yours differs
const userStore = require('../auth/userStore'); // for role assignment to users

// ─── PERMISSIONS ───────────────────────────────────────────────

// GET /iam/permissions  — list all available permission keys
router.get('/permissions', (req, res) => {
  try {
    const permissions = iamStore.getAllPermissions();
    res.json({ permissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /iam/permissions  — add a new custom permission key
router.post('/permissions', (req, res) => {
  try {
    const { key, description } = req.body;
    if (!key) return res.status(400).json({ error: 'Permission key is required' });
    if (!key.includes(':')) return res.status(400).json({ error: 'Key must be in format service:Action (e.g. s3:GetObject)' });

    // ALL_PERMISSIONS lives in iamStore — we extend it at runtime
    const perms = iamStore.getAllPermissions();
    if (perms[key]) return res.status(409).json({ error: `Permission "${key}" already exists` });

    iamStore.addPermission(key, description || '');
    res.status(201).json({ message: `Permission "${key}" created`, key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ROLES ─────────────────────────────────────────────────────

// GET /iam/roles  — list all roles
router.get('/roles', (req, res) => {
  try {
    const roles = iamStore.listRoles();
    res.json({ roles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /iam/roles/:id  — get a single role
router.get('/roles/:id', (req, res) => {
  try {
    const role = iamStore.getRole(req.params.id);
    res.json({ role });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /iam/roles  — create a custom role
router.post('/roles', (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    if (!name) return res.status(400).json({ error: 'Role name is required' });
    if (!Array.isArray(permissions) || permissions.length === 0)
      return res.status(400).json({ error: 'At least one permission is required' });

    const role = iamStore.createRole(name, description || '', permissions);
    res.status(201).json({ message: `Role "${name}" created`, role });
  } catch (err) {
    const status = err.message.includes('already exists') ? 409 : 500;
    res.status(status).json({ error: err.message });
  }
});

// PUT /iam/roles/:id/permissions  — update permissions on a custom role
router.put('/roles/:id/permissions', (req, res) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions))
      return res.status(400).json({ error: 'permissions must be an array' });

    const role = iamStore.updateRolePermissions(req.params.id, permissions);
    res.json({ message: 'Permissions updated', role });
  } catch (err) {
    const status = err.message.includes('not found') ? 404
                 : err.message.includes('Cannot modify') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

// DELETE /iam/roles/:id  — delete a custom role
router.delete('/roles/:id', (req, res) => {
  try {
    iamStore.deleteRole(req.params.id);
    res.json({ message: `Role "${req.params.id}" deleted` });
  } catch (err) {
    const status = err.message.includes('not found') ? 404
                 : err.message.includes('Cannot delete') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;