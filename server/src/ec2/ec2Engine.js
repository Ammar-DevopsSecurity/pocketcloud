const Docker = require('dockerode');
const store = require('./ec2Store');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const docker = new Docker();

// AMI to Docker image mapping
const AMI_IMAGES = {
  'ami-pocketcloud-ubuntu': 'ubuntu:22.04',
  'ami-pocketcloud-alpine': 'alpine:latest',
  'ami-pocketcloud-node':   'node:18-alpine',
  'ami-pocketcloud-nginx':  'nginx:alpine'
};

// Get allowed ports from VPC security group
async function getSecurityGroupPorts(instance) {
  try {
    const vpcFile = path.join(__dirname, '../../vpc.json');
    if (!fs.existsSync(vpcFile)) return [22, 80, 443];

    const data = JSON.parse(fs.readFileSync(vpcFile, 'utf-8'));
    const vpc = data.vpcs[instance.vpcId];
    if (!vpc || !vpc.securityGroups.length) return [22, 80, 443];

    const sgId = vpc.securityGroups[0];
    const sg = data.securityGroups[sgId];
    if (!sg) return [22, 80, 443];

    return sg.inboundRules
      .map(rule => rule.fromPort)
      .filter(p => p > 0);
  } catch {
    return [22, 80, 443];
  }
}

async function launchInstance(instanceId) {
  const instance = store.getInstance(instanceId);
  const image = AMI_IMAGES[instance.ami] || 'ubuntu:22.04';

  console.log(`\n🖥️  Launching EC2 instance "${instanceId}"...`);
  console.log(`   Type: ${instance.instanceType}`);
  console.log(`   AMI: ${instance.ami} → ${image}`);

  try {
    // Pull image
    await pullImage(image);

    // Get security group ports — only declared ONCE
    const sgPorts = await getSecurityGroupPorts(instance);
    console.log(`   🔒 Security group ports: ${sgPorts.join(', ')}`);

    // Build port bindings
    const PortBindings = {};
    const ExposedPorts = {};
    sgPorts.forEach(port => {
      PortBindings[`${port}/tcp`] = [{ HostPort: '' }];
      ExposedPorts[`${port}/tcp`] = {};
    });

    // Create container
    const container = await docker.createContainer({
      Image: image,
      name: `pocketcloud-ec2-${instanceId}`,
      Cmd: ['/bin/sh', '-c', 'while true; do sleep 30; done'],
      Env: [
        `INSTANCE_ID=${instanceId}`,
        `INSTANCE_TYPE=${instance.instanceType}`,
        `PRIVATE_IP=${instance.privateIp}`,
        `USER_DATA=${instance.userData}`
      ],
      ExposedPorts,
      HostConfig: {
        Memory: instance.memoryMB * 1024 * 1024,
        NanoCpus: Math.floor(instance.cpu * 1e9),
        AutoRemove: false,
        NetworkMode: 'bridge',
        PortBindings
      },
      Labels: {
        'pocketcloud.type': 'ec2',
        'pocketcloud.instance-id': instanceId
      }
    });

    await container.start();

    const publicIp = `127.0.0.${Math.floor(Math.random() * 200) + 10}`;

    store.updateInstance(instanceId, {
      state: 'running',
      containerId: container.id,
      publicIp,
      exposedPorts: sgPorts,
      launchTime: new Date().toISOString(),
      stateHistory: [
        ...instance.stateHistory,
        { state: 'running', timestamp: new Date().toISOString() }
      ]
    });

    console.log(`✅ EC2 instance "${instanceId}" is running!`);
    console.log(`   Private IP: ${instance.privateIp}`);
    console.log(`   Public IP:  ${publicIp}`);

    return store.getInstance(instanceId);

  } catch (err) {
    store.updateInstance(instanceId, { state: 'error' });
    console.error(`❌ Failed to launch instance:`, err.message);
    throw err;
  }
}

async function stopInstance(instanceId) {
  const instance = store.getInstance(instanceId);
  if (!instance.containerId) throw new Error('Instance has no container');

  console.log(`⏹️  Stopping EC2 instance "${instanceId}"...`);

  try {
    const container = docker.getContainer(instance.containerId);
    await container.stop();

    store.updateInstance(instanceId, {
      state: 'stopped',
      stateHistory: [
        ...instance.stateHistory,
        { state: 'stopped', timestamp: new Date().toISOString() }
      ]
    });

    console.log(`✅ Instance "${instanceId}" stopped`);
    return store.getInstance(instanceId);
  } catch (err) {
    throw new Error(`Failed to stop: ${err.message}`);
  }
}

async function startInstance(instanceId) {
  const instance = store.getInstance(instanceId);
  if (!instance.containerId) throw new Error('Instance has no container');

  console.log(`▶️  Starting EC2 instance "${instanceId}"...`);

  try {
    const container = docker.getContainer(instance.containerId);
    await container.start();

    store.updateInstance(instanceId, {
      state: 'running',
      stateHistory: [
        ...instance.stateHistory,
        { state: 'running', timestamp: new Date().toISOString() }
      ]
    });

    console.log(`✅ Instance "${instanceId}" started`);
    return store.getInstance(instanceId);
  } catch (err) {
    throw new Error(`Failed to start: ${err.message}`);
  }
}

async function terminateInstance(instanceId) {
  const instance = store.getInstance(instanceId);

  console.log(`🗑️  Terminating EC2 instance "${instanceId}"...`);

  if (instance.containerId) {
    try {
      const container = docker.getContainer(instance.containerId);
      await container.stop().catch(() => {});
      await container.remove();
    } catch (err) {
      console.error('Container cleanup error:', err.message);
    }
  }

  store.deleteInstance(instanceId);
  console.log(`✅ Instance "${instanceId}" terminated`);
}

// Execute command inside instance
async function executeCommand(instanceId, command) {
  const instance = store.getInstance(instanceId);
  if (instance.state !== 'running') throw new Error('Instance is not running');
  if (!instance.containerId) throw new Error('No container found');

  const container = docker.getContainer(instance.containerId);

  const exec = await container.exec({
    Cmd: ['/bin/sh', '-c', command],
    AttachStdout: true,
    AttachStderr: true
  });

  return new Promise((resolve, reject) => {
    exec.start({}, (err, stream) => {
      if (err) return reject(err);

      let output = '';
      container.modem.demuxStream(
        stream,
        { write: chunk => { output += chunk.toString(); } },
        { write: chunk => { output += chunk.toString(); } }
      );

      stream.on('end', () => resolve(output.trim()));
      stream.on('error', reject);
    });
  });
}

// Get instance metrics
async function getInstanceMetrics(instanceId) {
  const instance = store.getInstance(instanceId);
  if (instance.state !== 'running' || !instance.containerId) {
    return { cpu: 0, memory: 0, state: instance.state };
  }

  try {
    const container = docker.getContainer(instance.containerId);
    const stats = await container.stats({ stream: false });

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = (cpuDelta / systemDelta) * 100;

    const memUsage = stats.memory_stats.usage || 0;
    const memLimit = stats.memory_stats.limit || 1;
    const memPercent = (memUsage / memLimit) * 100;

    return {
      cpu: cpuPercent.toFixed(2),
      memory: memPercent.toFixed(2),
      memoryUsedMB: (memUsage / 1024 / 1024).toFixed(1),
      state: instance.state
    };
  } catch {
    return { cpu: 0, memory: 0, state: instance.state };
  }
}

function pullImage(imageName) {
  return new Promise((resolve, reject) => {
    docker.pull(imageName, (err, stream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, err => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

module.exports = {
  launchInstance, stopInstance,
  startInstance, terminateInstance,
  executeCommand, getInstanceMetrics
};