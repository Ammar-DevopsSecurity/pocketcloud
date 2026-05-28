const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { runFunctionInDocker } = require('../docker/runner');

const CRON_FILE = path.join(__dirname, '../../crons.json');

// Active cron jobs in memory
const activeJobs = {};

function loadCrons() {
  if (!fs.existsSync(CRON_FILE)) return {};
  return JSON.parse(fs.readFileSync(CRON_FILE, 'utf-8'));
}

function saveCrons(crons) {
  fs.writeFileSync(CRON_FILE, JSON.stringify(crons, null, 2));
}

// CREATE a cron job
function createCronJob(name, schedule, functionName, payload = {}) {
  const crons = loadCrons();

  if (crons[name]) throw new Error(`Cron "${name}" already exists`);

  // Validate cron expression
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron expression: "${schedule}"`);
  }

  crons[name] = {
    name,
    schedule,
    functionName,
    payload,
    enabled: true,
    createdAt: new Date().toISOString(),
    lastRun: null,
    runCount: 0
  };

  saveCrons(crons);

  // Start it immediately
  startJob(name, crons[name]);

  return crons[name];
}

// START a single cron job
function startJob(name, cronData) {
  if (activeJobs[name]) {
    activeJobs[name].stop();
  }

  console.log(`⏱️  Scheduling "${name}" → ${cronData.schedule}`);

  activeJobs[name] = cron.schedule(cronData.schedule, async () => {
    console.log(`\n⏰ Cron fired: "${name}" at ${new Date().toISOString()}`);

    // Update run stats
    const crons = loadCrons();
    if (crons[name]) {
      crons[name].lastRun = new Date().toISOString();
      crons[name].runCount++;
      saveCrons(crons);
    }

    // Build event payload
    const event = {
      source: 'cron',
      cronName: name,
      schedule: cronData.schedule,
      firedAt: new Date().toISOString(),
      ...cronData.payload
    };

    try {
      console.log(`🐳 Running "${cronData.functionName}" via cron...`);
      const result = await runFunctionInDocker(cronData.functionName, event);
      console.log(`✅ Cron "${name}" completed:`, result.output);
    } catch (err) {
      console.error(`❌ Cron "${name}" failed:`, err.message);
    }
  });
}

// LOAD and start all enabled crons on server startup
function initScheduler() {
  const crons = loadCrons();
  const cronList = Object.values(crons);

  if (cronList.length === 0) {
    console.log('⏱️  No cron jobs configured');
    return;
  }

  cronList.forEach(c => {
    if (c.enabled) startJob(c.name, c);
  });

  console.log(`⏱️  Started ${cronList.length} cron job(s)`);
}

// LIST all cron jobs
function listCronJobs() {
  const crons = loadCrons();
  return Object.values(crons).map(c => ({
    ...c,
    isRunning: !!activeJobs[c.name]
  }));
}

// STOP and DELETE a cron job
function deleteCronJob(name) {
  const crons = loadCrons();
  if (!crons[name]) throw new Error(`Cron "${name}" not found`);

  // Stop the active job
  if (activeJobs[name]) {
    activeJobs[name].stop();
    delete activeJobs[name];
  }

  delete crons[name];
  saveCrons(crons);
}

// TOGGLE enable/disable
function toggleCronJob(name, enabled) {
  const crons = loadCrons();
  if (!crons[name]) throw new Error(`Cron "${name}" not found`);

  crons[name].enabled = enabled;
  saveCrons(crons);

  if (enabled) {
    startJob(name, crons[name]);
    console.log(`▶️  Cron "${name}" enabled`);
  } else {
    if (activeJobs[name]) {
      activeJobs[name].stop();
      delete activeJobs[name];
    }
    console.log(`⏸️  Cron "${name}" disabled`);
  }

  return crons[name];
}

module.exports = {
  createCronJob,
  listCronJobs,
  deleteCronJob,
  toggleCronJob,
  initScheduler
};