const Docker = require('dockerode');
const { Client } = require('pg');
const store = require('./rdsStore');
const crypto = require('crypto');

const docker = new Docker();

// Find an available port starting from 5433
async function findAvailablePort(startPort = 5433) {
  const instances = store.listInstances();
  const usedPorts = instances.map(i => i.port);
  let port = startPort;
  while (usedPorts.includes(port)) port++;
  return port;
}

// CREATE a new PostgreSQL instance
async function createRdsInstance(dbName, username, password) {
  const id = `rds-${crypto.randomBytes(4).toString('hex')}`;
  const port = await findAvailablePort();

  // Save to store first
  store.createInstance(id, { dbName, username, password, port });

  console.log(`\n🗄️  Creating RDS instance "${id}" on port ${port}...`);

  try {
    // Pull postgres image if not exists
    console.log('📥 Pulling postgres:15-alpine image...');
    await pullImage('postgres:15-alpine');

    // Create and start the container
    const container = await docker.createContainer({
      Image: 'postgres:15-alpine',
      name: `pocketcloud-rds-${id}`,
      Env: [
        `POSTGRES_DB=${dbName}`,
        `POSTGRES_USER=${username}`,
        `POSTGRES_PASSWORD=${password}`
      ],
      HostConfig: {
        PortBindings: {
          '5432/tcp': [{ HostPort: port.toString() }]
        },
        AutoRemove: false
      },
      ExposedPorts: { '5432/tcp': {} }
    });

    await container.start();

    // Wait for PostgreSQL to be ready
    console.log('⏳ Waiting for PostgreSQL to be ready...');
    await waitForPostgres(port, username, password, dbName);

    // Update store with container info
    store.updateInstance(id, {
      status: 'available',
      containerId: container.id
    });

    console.log(`✅ RDS instance "${id}" is ready on port ${port}`);

    return store.getInstance(id);

  } catch (err) {
    store.updateInstance(id, { status: 'failed' });
    console.error(`❌ Failed to create RDS instance:`, err.message);
    throw err;
  }
}

// Wait until PostgreSQL accepts connections
async function waitForPostgres(port, user, password, database, retries = 20) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = new Client({ host: 'localhost', port, user, password, database, connectionTimeoutMillis: 2000 });
      await client.connect();
      await client.end();
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  throw new Error('PostgreSQL did not become ready in time');
}

// EXECUTE a SQL query on an instance
async function executeQuery(instanceId, sql) {
  const instance = store.getInstance(instanceId);

  if (instance.status !== 'available') {
    throw new Error(`Instance "${instanceId}" is not available (status: ${instance.status})`);
  }

  const client = new Client({
    host: 'localhost',
    port: instance.port,
    user: instance.username,
    password: instance.password,
    database: instance.dbName,
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    const result = await client.query(sql);
    await client.end();

    return {
      rows: result.rows,
      rowCount: result.rowCount,
      command: result.command,
      fields: result.fields?.map(f => ({ name: f.name, dataType: f.dataTypeID }))
    };
  } catch (err) {
    await client.end().catch(() => {});
    throw new Error(`Query failed: ${err.message}`);
  }
}

// DELETE an instance — stop and remove container
async function deleteRdsInstance(instanceId) {
  const instance = store.getInstance(instanceId);

  if (instance.containerId) {
    try {
      const container = docker.getContainer(instance.containerId);
      await container.stop();
      await container.remove();
      console.log(`🗑️  Container for "${instanceId}" removed`);
    } catch (err) {
      console.error('Container cleanup error:', err.message);
    }
  }

  store.deleteInstance(instanceId);
}

// Helper — pull Docker image
function pullImage(imageName) {
  return new Promise((resolve, reject) => {
    docker.pull(imageName, (err, stream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

module.exports = { createRdsInstance, executeQuery, deleteRdsInstance };