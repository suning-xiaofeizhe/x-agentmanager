'use strict';

const Subscription = require('egg').Subscription;

class CreateProcessTable extends Subscription {
  static get schedule() {
    return {
      cron: '0 0 0 * * *',
      type: 'worker',
      immediate: true,
    };
  }

  async subscribe() {
    const { ctx: { service: { mysql } } } = this;
    const tasks = [];
    tasks.push(mysql.createProcessTable());
    tasks.push(mysql.createAlarmRecordTable());
    await Promise.all(tasks);
  }
}

module.exports = CreateProcessTable;
