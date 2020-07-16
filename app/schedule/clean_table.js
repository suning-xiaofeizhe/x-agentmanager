'use strict';

const fs = require('fs');
const path = require('path');
const promisify = require('util').promisify;
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const Subscription = require('egg').Subscription;

class CleanProcessTable extends Subscription {
  static get schedule() {
    return {
      cron: '0 0 0 * * *',
      type: 'worker',
      immediate: true,
    };
  }

  async subscribe() {
    const { ctx: { app: { config: { logger } }, service: { mysql } } } = this;
    const tasks = [];
    tasks.push(mysql.cleanOldProcessTable());
    tasks.push(mysql.cleanOldAlarmTable());
    tasks.push(mysql.cleanOldOsInfoTable());


    if (logger && logger.dir) {
      const dir = logger.dir;
      const files = await readdir(dir);
      for (const file of files) {
        const shouldDelete = /\d{4}-\d{2}-\d{2}/;
        if (!shouldDelete.test(file)) {
          continue;
        }
        const filePath = path.join(dir, file);
        const fileState = await stat(filePath);
        if (fileState.isFile()) {
          try {
            await unlink(filePath);
          } catch (err) {
            this.ctx.logger.error(err);
          }
        }
      }
    }

    await Promise.all(tasks);
  }
}

module.exports = CleanProcessTable;
