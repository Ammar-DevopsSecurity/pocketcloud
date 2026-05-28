const express = require('express');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const secretsRoutes = require('./routes/secrets');
const metricsMiddleware = require('./middleware/metrics');
const metricsRoutes = require('./routes/metrics');

const rdsRoutes = require('./routes/rds');
const bucketRoutes = require('./routes/buckets');
const objectRoutes = require('./routes/objects');
const keyRoutes = require('./routes/keys');
const queueRoutes = require('./routes/queues');
const authMiddleware = require('./middleware/auth');
const cronRoutes = require('./routes/crons');
const { initScheduler } = require('./cron/scheduler');
const authRoutes = require('./routes/auth');
const gatewayRoutes = require('./routes/gateway');
const snsRoutes = require('./routes/sns');
const { gatewayMiddleware } = require('./gateway/gatewayEngine');
const app = express();
const PORT = process.env.PORT || 4566;
const vpcRoutes = require('./routes/vpc');
const ec2Routes = require('./routes/ec2');
const billingMiddleware = require('./billing/billingMiddleware');
const billingRoutes = require('./routes/billing');
const { startBillingTimers } = require('./billing/ec2BillingTimer');
const aiRoutes = require('./routes/ai');
const iamRoutes = require('./routes/iam');

// Make sure temp folder exists
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// In-memory activity log
const activityLog = [];

// ─── MIDDLEWARE ───
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../public')));
app.use(billingMiddleware);


// ─── PUBLIC ROUTES (no auth needed) ───
app.get('/health', (req, res) => {
  res.json({ status: 'PocketCloud is running 🚀', port: PORT });
});

app.get('/logs', (req, res) => {
  res.json({ logs: activityLog.slice(-50).reverse() });
});

app.use('/keys', keyRoutes);
app.use('/auth', authRoutes);
app.get('/metrics', (req, res) => {
  const store = require('./metrics/metricsStore');
  res.json(store.getMetrics());
});
app.use(metricsMiddleware);


// ─── AUTH MIDDLEWARE (protects everything below) ───
app.use(authMiddleware);

// ─── PROTECTED ROUTES ───
app.use('/buckets', bucketRoutes);
app.use('/buckets/:bucketName/objects', objectRoutes);
app.use('/queues', queueRoutes);
app.use('/crons', cronRoutes);
app.use('/gateway', gatewayRoutes);
app.use('/api', gatewayMiddleware); 
app.use('/sns', snsRoutes);
app.use('/rds', rdsRoutes);
app.use('/secrets', secretsRoutes);
app.use('/vpc', vpcRoutes);
app.use('/ec2', ec2Routes);
app.use('/billing', billingRoutes);
app.use('/ai', aiRoutes);
app.use('/iam', iamRoutes);

// ─── START SERVER ───
app.locals.activityLog = activityLog;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`☁️  PocketCloud running on http://localhost:${PORT}`);
  console.log(`📦 Storage: ${path.join(__dirname, '../storage')}`);
});
startBillingTimers();
initScheduler();