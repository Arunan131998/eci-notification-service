const client = require('prom-client');

client.collectDefaultMetrics();

const notificationsSentTotal = new client.Counter({
  name: 'notifications_sent_total',
  help: 'Total notifications sent'
});

module.exports = {
  register: client.register,
  notificationsSentTotal
};
