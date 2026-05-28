const express = require('express');
const router = express.Router();
const vpcStore = require('../vpc/vpcStore');

// VPC routes
router.post('/', (req, res) => {
  try {
    const { name, cidrBlock, region } = req.body;
    if (!name || !cidrBlock) return res.status(400).json({ error: 'name and cidrBlock required' });
    const result = vpcStore.createVpc(name, cidrBlock, region);
    res.status(201).json({ message: 'VPC created', ...result });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/', (req, res) => {
  try { res.json({ vpcs: vpcStore.listVpcs() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', (req, res) => {
  try { res.json(vpcStore.getVpc(req.params.id)); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try { vpcStore.deleteVpc(req.params.id); res.json({ message: 'VPC deleted' }); }
  catch (err) { res.status(404).json({ error: err.message }); }
});
// ADD inbound rule to security group
router.post('/security-groups/:sgId/rules', (req, res) => {
  try {
    const { protocol, fromPort, toPort, source, description } = req.body;
    const data = require('../vpc/vpcStore').loadRaw();
    const sg = data.securityGroups[req.params.sgId];
    if (!sg) return res.status(404).json({ error: 'Security group not found' });

    sg.inboundRules.push({
      protocol: protocol || 'tcp',
      fromPort: parseInt(fromPort),
      toPort: parseInt(toPort || fromPort),
      source: source || '0.0.0.0/0',
      description: description || ''
    });

    require('fs').writeFileSync(
      require('path').join(__dirname, '../../vpc.json'),
      JSON.stringify(data, null, 2)
    );

    res.json({ message: 'Rule added', securityGroup: sg });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE inbound rule
router.delete('/security-groups/:sgId/rules/:index', (req, res) => {
  try {
    const data = require('../vpc/vpcStore').loadRaw();
    const sg = data.securityGroups[req.params.sgId];
    if (!sg) return res.status(404).json({ error: 'Security group not found' });

    sg.inboundRules.splice(parseInt(req.params.index), 1);

    require('fs').writeFileSync(
      require('path').join(__dirname, '../../vpc.json'),
      JSON.stringify(data, null, 2)
    );

    res.json({ message: 'Rule deleted', securityGroup: sg });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// Subnet routes
router.post('/:vpcId/subnets', (req, res) => {
  try {
    const { name, cidrBlock, type } = req.body;
    if (!name || !cidrBlock) return res.status(400).json({ error: 'name and cidrBlock required' });
    const subnet = vpcStore.createSubnet(req.params.vpcId, name, cidrBlock, type);
    res.status(201).json({ message: 'Subnet created', subnet });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/:vpcId/subnets', (req, res) => {
  try { res.json({ subnets: vpcStore.listSubnets(req.params.vpcId) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:vpcId/security-groups', (req, res) => {
  try { res.json({ securityGroups: vpcStore.listSecurityGroups(req.params.vpcId) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;