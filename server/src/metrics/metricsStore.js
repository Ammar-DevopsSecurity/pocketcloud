const fs = require('fs');
const path = require('path');

const METRICS_FILE = path.join(__dirname, '../../metrics.json');

function load() {
  if (!fs.existsSync(METRICS_FILE)) return {
    requests: [],
    counters: {
      totalRequests: 0,
      totalErrors: 0,
      s3Requests: 0,
      sqsRequests: 0,
      snsRequests: 0,
      secretsRequests: 0,
      cronFires: 0,
      dockerRuns: 0
    },
    responseTimes: []
  };
  return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf-8'));
}

function save(data) {
  fs.writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2));
}

// RECORD a request
function recordRequest(method, path, statusCode, responseTimeMs) {
  const data = load();

  // Keep only last 500 requests
  data.requests.push({
    method,
    path,
    statusCode,
    responseTimeMs,
    timestamp: new Date().toISOString()
  });

  if (data.requests.length > 500) {
    data.requests = data.requests.slice(-500);
  }

  // Update counters
  data.counters.totalRequests++;
  if (statusCode >= 400) data.counters.totalErrors++;
  if (path.startsWith('/buckets')) data.counters.s3Requests++;
  if (path.startsWith('/queues')) data.counters.sqsRequests++;
  if (path.startsWith('/sns')) data.counters.snsRequests++;
  if (path.startsWith('/secrets')) data.counters.secretsRequests++;

  // Keep last 100 response times
  data.responseTimes.push(responseTimeMs);
  if (data.responseTimes.length > 100) {
    data.responseTimes = data.responseTimes.slice(-100);
  }

  save(data);
}

// INCREMENT a specific counter
function increment(counterName) {
  const data = load();
  if (data.counters[counterName] !== undefined) {
    data.counters[counterName]++;
    save(data);
  }
}

// GET metrics summary
function getMetrics() {
  const data = load();
  const times = data.responseTimes;

  // Calculate average response time
  const avgResponseTime = times.length > 0
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : 0;

  // Calculate error rate
  const errorRate = data.counters.totalRequests > 0
    ? ((data.counters.totalErrors / data.counters.totalRequests) * 100).toFixed(1)
    : 0;

  // Requests per minute (last 60 seconds)
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  const recentRequests = data.requests.filter(r => r.timestamp > oneMinuteAgo);

  // Group requests by service for chart
  const requestsByService = {
    S3: data.counters.s3Requests,
    SQS: data.counters.sqsRequests,
    SNS: data.counters.snsRequests,
    Secrets: data.counters.secretsRequests
  };

  // Last 20 requests for timeline
  const recentTimeline = data.requests.slice(-20).map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString(),
    responseTime: r.responseTimeMs,
    status: r.statusCode
  }));

  return {
    counters: data.counters,
    avgResponseTime,
    errorRate,
    requestsPerMinute: recentRequests.length,
    requestsByService,
    recentTimeline
  };
}

// RESET all metrics
function resetMetrics() {
  fs.writeFileSync(METRICS_FILE, JSON.stringify({
    requests: [],
    counters: {
      totalRequests: 0,
      totalErrors: 0,
      s3Requests: 0,
      sqsRequests: 0,
      snsRequests: 0,
      secretsRequests: 0,
      cronFires: 0,
      dockerRuns: 0
    },
    responseTimes: []
  }, null, 2));
}

module.exports = { recordRequest, increment, getMetrics, resetMetrics };