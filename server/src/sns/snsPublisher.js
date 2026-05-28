const axios = require('axios');
const { getTopic, incrementMessageCount } = require('./snsStore');

// PUBLISH message to all subscribers
async function publish(topicName, message, subject = '') {
  const topic = getTopic(topicName);
  const results = [];

  console.log(`\n📨 SNS Publishing to "${topicName}" (${topic.subscriptions.length} subscribers)`);

  for (const sub of topic.subscriptions) {
    const result = await deliverToSubscriber(sub, topicName, message, subject);
    results.push(result);
  }

  incrementMessageCount(topicName);

  return {
    messageId: require('crypto').randomBytes(12).toString('hex'),
    topicName,
    subscribersNotified: results.length,
    results
  };
}

async function deliverToSubscriber(sub, topicName, message, subject) {
  console.log(`  → Delivering to ${sub.protocol}:${sub.endpoint}`);

  try {
    switch (sub.protocol) {

      // HTTP/HTTPS webhook delivery
      case 'http':
      case 'https':
        await axios.post(sub.endpoint, {
          Type: 'Notification',
          TopicArn: `arn:pocketcloud:sns:local:123456789:${topicName}`,
          Subject: subject,
          Message: message,
          Timestamp: new Date().toISOString()
        }, { timeout: 5000 });

        console.log(`  ✅ HTTP delivered to ${sub.endpoint}`);
        return { subscriptionId: sub.id, protocol: sub.protocol, status: 'delivered' };

      // Email — just log it (real email needs SMTP)
      case 'email':
        console.log(`  📧 EMAIL to ${sub.endpoint}:`);
        console.log(`     Subject: ${subject || topicName}`);
        console.log(`     Message: ${message}`);
        return { subscriptionId: sub.id, protocol: sub.protocol, status: 'logged', note: 'Email logged to console' };

      // SQS — send to our local queue
      case 'sqs':
        const queueName = sub.endpoint;
        const { sendMessage } = require('../queues/queueStore');
        sendMessage(queueName, {
          source: 'sns',
          topicName,
          subject,
          message,
          timestamp: new Date().toISOString()
        });
        console.log(`  ✅ SQS message sent to queue "${queueName}"`);
        return { subscriptionId: sub.id, protocol: sub.protocol, status: 'delivered' };

      default:
        return { subscriptionId: sub.id, protocol: sub.protocol, status: 'unsupported' };
    }
  } catch (err) {
    console.error(`  ❌ Failed to deliver to ${sub.endpoint}:`, err.message);
    return { subscriptionId: sub.id, protocol: sub.protocol, status: 'failed', error: err.message };
  }
}

module.exports = { publish };