const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const QUEUES_FILE = path.join(__dirname, '../../queues.json');

function loadQueues() {
  if (!fs.existsSync(QUEUES_FILE)) return {};
  return JSON.parse(fs.readFileSync(QUEUES_FILE, 'utf-8'));
}

function saveQueues(queues) {
  fs.writeFileSync(QUEUES_FILE, JSON.stringify(queues, null, 2));
}

// CREATE a queue
function createQueue(name, options = {}) {
  const queues = loadQueues();
  if (queues[name]) throw new Error(`Queue "${name}" already exists`);

  queues[name] = {
    name,
    messages: [],
    createdAt: new Date().toISOString(),
    // How long before unprocessed message becomes visible again (seconds)
    visibilityTimeout: options.visibilityTimeout || 30,
    // Max messages to keep
    maxSize: options.maxSize || 1000
  };

  saveQueues(queues);
  return { name, createdAt: queues[name].createdAt };
}

// LIST all queues
function listQueues() {
  const queues = loadQueues();
  return Object.values(queues).map(q => ({
    name: q.name,
    messageCount: q.messages.filter(m => !m.inFlight).length,
    inFlightCount: q.messages.filter(m => m.inFlight).length,
    createdAt: q.createdAt
  }));
}

// SEND a message to a queue
function sendMessage(queueName, body, options = {}) {
  const queues = loadQueues();
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue "${queueName}" not found`);

  if (queue.messages.length >= queue.maxSize) {
    throw new Error(`Queue "${queueName}" is full (max ${queue.maxSize} messages)`);
  }

  const message = {
    id: crypto.randomBytes(12).toString('hex'),
    body,                          // the actual message content
    sentAt: new Date().toISOString(),
    inFlight: false,               // true when someone is processing it
    receiptHandle: null,           // used to delete after processing
    delaySeconds: options.delaySeconds || 0,
    receiveCount: 0                // how many times this was received
  };

  queue.messages.push(message);
  saveQueues(queues);

  return { messageId: message.id, sentAt: message.sentAt };
}

// RECEIVE messages from queue (like polling)
function receiveMessages(queueName, maxMessages = 1) {
  const queues = loadQueues();
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue "${queueName}" not found`);

  // Get available (not in-flight) messages
  const available = queue.messages.filter(m => !m.inFlight);
  const toReturn = available.slice(0, maxMessages);

  if (toReturn.length === 0) return [];

  // Mark as in-flight
  toReturn.forEach(msg => {
    msg.inFlight = true;
    msg.receiptHandle = crypto.randomBytes(16).toString('hex');
    msg.receiveCount++;
    msg.inFlightSince = new Date().toISOString();
  });

  saveQueues(queues);

  return toReturn.map(msg => ({
    id: msg.id,
    body: msg.body,
    receiptHandle: msg.receiptHandle,
    sentAt: msg.sentAt,
    receiveCount: msg.receiveCount
  }));
}

// DELETE a message after processing (using receiptHandle)
function deleteMessage(queueName, receiptHandle) {
  const queues = loadQueues();
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue "${queueName}" not found`);

  const before = queue.messages.length;
  queue.messages = queue.messages.filter(m => m.receiptHandle !== receiptHandle);

  if (queue.messages.length === before) {
    throw new Error('Message not found or already deleted');
  }

  saveQueues(queues);
}

// GET queue stats
function getQueueStats(queueName) {
  const queues = loadQueues();
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue "${queueName}" not found`);

  return {
    name: queue.name,
    totalMessages: queue.messages.length,
    available: queue.messages.filter(m => !m.inFlight).length,
    inFlight: queue.messages.filter(m => m.inFlight).length,
    visibilityTimeout: queue.visibilityTimeout,
    createdAt: queue.createdAt
  };
}

// DELETE a queue
function deleteQueue(name) {
  const queues = loadQueues();
  if (!queues[name]) throw new Error(`Queue "${name}" not found`);
  delete queues[name];
  saveQueues(queues);
}

module.exports = {
  createQueue,
  listQueues,
  sendMessage,
  receiveMessages,
  deleteMessage,
  getQueueStats,
  deleteQueue
};