let activityLog = null;

// Called once from app.js to connect the log array
function setActivityLog(log) {
  activityLog = log;
}
const fs = require('fs');
const path = require('path');

// Load the rules from triggers.json
const TRIGGERS_PATH = path.join(__dirname, '../../triggers.json');
const FUNCTIONS_PATH = path.join(__dirname, '../../functions');

function loadRules() {
  if (!fs.existsSync(TRIGGERS_PATH)) return [];
  const raw = fs.readFileSync(TRIGGERS_PATH, 'utf-8');
  const config = JSON.parse(raw);
  return config.rules || [];
}

// This is called every time a file is uploaded
// It checks if any rule matches and fires the function
async function processTriggers(event) {
  const rules = loadRules();
  if (activityLog) {
  activityLog.push({
    type: 'TRIGGER',
    message: `🔥 Triggered "${rule.function}" for "${event.key}" in "${event.bucket}"`,
    timestamp: new Date().toISOString()
  });
}

  // event looks like: { bucket, key, mimeType, uploadedAt }
  const matchingRules = rules.filter(rule =>
    rule.enabled &&
    rule.bucket === event.bucket &&
    rule.event === event.event
  );

  if (matchingRules.length === 0) {
    console.log(`⏭️  No triggers matched for bucket "${event.bucket}"`);
    return;
  }

  for (const rule of matchingRules) {
    console.log(`\n🔥 Trigger matched! Rule: "${rule.id}" → Function: "${rule.function}"`);
    await runFunction(rule.function, event);
  }
}

const { runFunctionInDocker } = require('../docker/runner');

async function runFunction(functionName, event) {
  const fnPath = path.join(FUNCTIONS_PATH, functionName, 'handler.js');

  if (!fs.existsSync(fnPath)) {
    console.error(`❌ Function "${functionName}" not found`);
    return;
  }

  try {
    console.log(`🐳 Running "${functionName}" in Docker...`);
    const result = await runFunctionInDocker(functionName, event);
    console.log('✅ Docker result:', result);
  } catch (err) {
    console.error(`❌ Docker run failed:`, err.message);
  }
} 
module.exports = { processTriggers, setActivityLog };