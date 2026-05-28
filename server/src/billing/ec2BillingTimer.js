const { recordUsage } = require('./billingStore');

const EC2_HOURLY_RATES = {
  't2.nano':   'ec2_t2_nano',
  't2.micro':  'ec2_t2_micro',
  't2.small':  'ec2_t2_small',
  't2.medium': 'ec2_t2_medium',
  't2.large':  'ec2_t2_large'
};

function startBillingTimers() {
  console.log('💰 Billing timers started');

  // Charge EC2 instances every hour
  // For demo we charge every 60 seconds = 1 "hour"
  setInterval(() => {
    try {
      const ec2Store = require('../ec2/ec2Store');
      const instances = ec2Store.listInstances();

      instances.forEach(instance => {
        if (instance.state === 'running') {
          const rateKey = EC2_HOURLY_RATES[instance.instanceType] || 'ec2_t2_micro';
          const result = recordUsage('ec2', rateKey.replace('ec2_', ''), 1, {
            instanceId: instance.id,
            instanceType: instance.instanceType
          });
          console.log(`💰 EC2 billing: ${instance.id} (${instance.instanceType}) → $${result.cost.toFixed(8)}`);
        }
      });
    } catch (err) {
      console.error('EC2 billing error:', err.message);
    }

    // Charge RDS instances
    try {
      const rdsStore = require('../rds/rdsStore');
      const instances = rdsStore.listInstances();

      instances.forEach(instance => {
        if (instance.status === 'available') {
          const result = recordUsage('rds', 'hour', 1, {
            instanceId: instance.id,
            dbName: instance.dbName
          });
          console.log(`💰 RDS billing: ${instance.id} → $${result.cost.toFixed(8)}`);
        }
      });
    } catch (err) {
      console.error('RDS billing error:', err.message);
    }

  }, 60000); // Every 60 seconds for demo
}

module.exports = { startBillingTimers };