const fs = require('fs');
const path = require('path');

const BILLING_FILE = path.join(__dirname, '../../billing.json');

// AWS-like pricing (per unit)
const PRICING = {
  's3_put':          0.000005,    // per PUT request
  's3_get':          0.0000004,   // per GET request
  's3_delete':       0.000005,    // per DELETE request
  's3_storage_gb':   0.023,       // per GB per month
  'lambda_invoke':   0.0000002,   // per invocation
  'lambda_duration': 0.0000000021,// per ms
  'rds_hour':        0.017,       // per hour (db.t3.micro)
  'ec2_t2_nano':     0.0058,      // per hour
  'ec2_t2_micro':    0.0116,      // per hour
  'ec2_t2_small':    0.023,       // per hour
  'ec2_t2_medium':   0.046,       // per hour
  'ec2_t2_large':    0.0928,      // per hour
  'sqs_request':     0.0000004,   // per request
  'sns_publish':     0.000000500, // per publish
  'secrets_api':     0.000005,    // per API call
  'data_transfer':   0.09,        // per GB out
};

function load() {
  if (!fs.existsSync(BILLING_FILE)) return {
    totalCost: 0,
    monthlyCost: 0,
    todayCost: 0,
    byService: {},
    transactions: [],
    startDate: new Date().toISOString()
  };
  return JSON.parse(fs.readFileSync(BILLING_FILE, 'utf-8'));
}

function save(data) {
  fs.writeFileSync(BILLING_FILE, JSON.stringify(data, null, 2));
}

// RECORD a billable event
function recordUsage(service, operation, units = 1, metadata = {}) {
  const data = load();
  const priceKey = `${service}_${operation}`;
  const unitPrice = PRICING[priceKey] || 0;
  const cost = unitPrice * units;

  // Add to transactions (keep last 1000)
  data.transactions.push({
    service,
    operation,
    units,
    unitPrice,
    cost,
    metadata,
    timestamp: new Date().toISOString()
  });

  if (data.transactions.length > 1000) {
    data.transactions = data.transactions.slice(-1000);
  }

  // Update totals
  data.totalCost = (data.totalCost || 0) + cost;

  // Update by service
  if (!data.byService[service]) {
    data.byService[service] = { cost: 0, requests: 0 };
  }
  data.byService[service].cost += cost;
  data.byService[service].requests += units;

  // Update today's cost
  const today = new Date().toDateString();
  const todayTransactions = data.transactions.filter(t =>
    new Date(t.timestamp).toDateString() === today
  );
  data.todayCost = todayTransactions.reduce((sum, t) => sum + t.cost, 0);

  // Update monthly cost
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const monthTransactions = data.transactions.filter(t => {
    const d = new Date(t.timestamp);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  data.monthlyCost = monthTransactions.reduce((sum, t) => sum + t.cost, 0);

  save(data);
  return { cost, priceKey, unitPrice };
}

// GET billing summary
function getBillingSummary() {
  const data = load();

  // Top 5 most expensive services
  const topServices = Object.entries(data.byService)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 5)
    .map(([service, info]) => ({ service, ...info }));

  // Last 10 transactions
  const recentTransactions = data.transactions.slice(-10).reverse();

  // Hourly breakdown for today
  const today = new Date().toDateString();
  const todayTransactions = data.transactions.filter(t =>
    new Date(t.timestamp).toDateString() === today
  );

  const hourlyBreakdown = {};
  todayTransactions.forEach(t => {
    const hour = new Date(t.timestamp).getHours();
    hourlyBreakdown[hour] = (hourlyBreakdown[hour] || 0) + t.cost;
  });

  return {
    totalCost: data.totalCost || 0,
    monthlyCost: data.monthlyCost || 0,
    todayCost: data.todayCost || 0,
    byService: data.byService || {},
    topServices,
    recentTransactions,
    hourlyBreakdown,
    pricing: PRICING,
    startDate: data.startDate
  };
}

// RESET billing
function resetBilling() {
  fs.writeFileSync(BILLING_FILE, JSON.stringify({
    totalCost: 0,
    monthlyCost: 0,
    todayCost: 0,
    byService: {},
    transactions: [],
    startDate: new Date().toISOString()
  }, null, 2));
}

module.exports = { recordUsage, getBillingSummary, resetBilling, PRICING };