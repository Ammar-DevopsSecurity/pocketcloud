const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SNS_FILE = path.join(__dirname, '../../sns.json');

function load() {
  if (!fs.existsSync(SNS_FILE)) return { topics: {} };
  return JSON.parse(fs.readFileSync(SNS_FILE, 'utf-8'));
}

function save(data) {
  fs.writeFileSync(SNS_FILE, JSON.stringify(data, null, 2));
}

// CREATE topic
function createTopic(name) {
  const data = load();
  if (data.topics[name]) throw new Error(`Topic "${name}" already exists`);

  const topicArn = `arn:pocketcloud:sns:local:123456789:${name}`;

  data.topics[name] = {
    name,
    topicArn,
    subscriptions: [],
    createdAt: new Date().toISOString(),
    messageCount: 0
  };

  save(data);
  return { name, topicArn };
}

// LIST topics
function listTopics() {
  const data = load();
  return Object.values(data.topics).map(t => ({
    name: t.name,
    topicArn: t.topicArn,
    subscriptionCount: t.subscriptions.length,
    messageCount: t.messageCount,
    createdAt: t.createdAt
  }));
}

// DELETE topic
function deleteTopic(name) {
  const data = load();
  if (!data.topics[name]) throw new Error(`Topic "${name}" not found`);
  delete data.topics[name];
  save(data);
}

// SUBSCRIBE to a topic
function subscribe(topicName, protocol, endpoint) {
  const data = load();
  const topic = data.topics[topicName];
  if (!topic) throw new Error(`Topic "${topicName}" not found`);

  // protocol can be: 'http', 'https', 'email', 'sqs'
  const validProtocols = ['http', 'https', 'email', 'sqs'];
  if (!validProtocols.includes(protocol)) {
    throw new Error(`Invalid protocol. Use: ${validProtocols.join(', ')}`);
  }

  const subscriptionId = crypto.randomBytes(8).toString('hex');

  topic.subscriptions.push({
    id: subscriptionId,
    protocol,
    endpoint,
    createdAt: new Date().toISOString()
  });

  save(data);
  return { subscriptionId, topicName, protocol, endpoint };
}

// UNSUBSCRIBE
function unsubscribe(topicName, subscriptionId) {
  const data = load();
  const topic = data.topics[topicName];
  if (!topic) throw new Error(`Topic "${topicName}" not found`);

  const before = topic.subscriptions.length;
  topic.subscriptions = topic.subscriptions.filter(s => s.id !== subscriptionId);

  if (topic.subscriptions.length === before) {
    throw new Error(`Subscription "${subscriptionId}" not found`);
  }

  save(data);
}

// GET topic with subscriptions
function getTopic(name) {
  const data = load();
  if (!data.topics[name]) throw new Error(`Topic "${name}" not found`);
  return data.topics[name];
}

// INCREMENT message count
function incrementMessageCount(topicName) {
  const data = load();
  if (data.topics[topicName]) {
    data.topics[topicName].messageCount++;
    save(data);
  }
}

module.exports = {
  createTopic,
  listTopics,
  deleteTopic,
  subscribe,
  unsubscribe,
  getTopic,
  incrementMessageCount
};