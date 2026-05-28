const express = require('express');
const router = express.Router();
const store = require('../ec2/ec2Store');
const engine = require('../ec2/ec2Engine');
const iamStore = require('../iam/iamStore');

// ─── RBAC Helper ───
function checkEc2Permission(req, res, action) {
  const permissions = req.apiKey?.permissions || [];

  if (!iamStore.hasPermission(permissions, action)) {
    res.status(403).json({
      error: 'Access denied',
      required: action,
      yourRole: req.apiKey?.assignedRole || req.apiKey?.role || 'unknown',
      hint: `You need "${action}" permission. Ask an admin to assign you the VM Contributor or Admin role.`
    });
    return false;
  }
  return true;
}

// GET instance types — public, no permission needed
router.get('/instance-types', (req, res) => {
  res.json({ instanceTypes: store.getInstanceTypes() });
});

// Launch instance — requires ec2:launch
router.post('/instances', async (req, res) => {
  if (!checkEc2Permission(req, res, 'ec2:launch')) return;

  try {
    const { name, instanceType, ami, vpcId, subnetId, userData } = req.body;
    if (!name || !vpcId) return res.status(400).json({ error: 'name and vpcId required' });

    const instance = store.createInstance({ name, instanceType, ami, vpcId, subnetId, userData });

    res.status(202).json({
      message: 'Instance launching... (~15 seconds)',
      instance,
      hint: 'Poll GET /ec2/instances to check status'
    });

    // Launch in background
    engine.launchInstance(instance.id).catch(err => {
      console.error('Launch failed:', err.message);
    });

  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List instances — requires ec2:read
router.get('/instances', (req, res) => {
  if (!checkEc2Permission(req, res, 'ec2:read')) return;

  try {
    const { vpcId } = req.query;
    res.json({ instances: store.listInstances(vpcId) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get single instance — requires ec2:read
router.get('/instances/:id', (req, res) => {
  if (!checkEc2Permission(req, res, 'ec2:read')) return;

  try {
    res.json(store.getInstance(req.params.id));
  } catch (err) { res.status(404).json({ error: err.message }); }
});

// Get instance metrics — requires ec2:read
router.get('/instances/:id/metrics', async (req, res) => {
  if (!checkEc2Permission(req, res, 'ec2:read')) return;

  try {
    const metrics = await engine.getInstanceMetrics(req.params.id);
    res.json({ metrics });
  } catch (err) { res.status(404).json({ error: err.message }); }
});

// Stop instance — requires ec2:stop
router.post('/instances/:id/stop', async (req, res) => {
  if (!checkEc2Permission(req, res, 'ec2:stop')) return;

  try {
    const instance = await engine.stopInstance(req.params.id);
    res.json({ message: 'Instance stopped', instance });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Start instance — requires ec2:launch (same level as launching)
router.post('/instances/:id/start', async (req, res) => {
  if (!checkEc2Permission(req, res, 'ec2:launch')) return;

  try {
    const instance = await engine.startInstance(req.params.id);
    res.json({ message: 'Instance started', instance });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Execute command — requires ec2:launch (contributor level)
router.post('/instances/:id/execute', async (req, res) => {
  if (!checkEc2Permission(req, res, 'ec2:launch')) return;

  try {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'command required' });
    const output = await engine.executeCommand(req.params.id, command);
    res.json({ output, instanceId: req.params.id });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Terminate instance — requires ec2:terminate (admin level)
router.delete('/instances/:id', async (req, res) => {
  if (!checkEc2Permission(req, res, 'ec2:terminate')) return;

  try {
    await engine.terminateInstance(req.params.id);
    res.json({ message: 'Instance terminated' });
  } catch (err) { res.status(404).json({ error: err.message }); }
});

module.exports = router;