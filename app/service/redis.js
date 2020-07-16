'use strict';

const moment = require('moment');
const Service = require('egg').Service;

class RedisService extends Service {
  composeAgentListKey(appId) {
    const { ctx: { app: { config } } } = this;
    return `${config.agentListKeyPrefix}${appId}`;
  }

  composeErrorLogFileKey(appId, agentId) {
    const { ctx: { app: { config } } } = this;
    return `${config.errorLogFileKeyPrefix}${appId}::${agentId}`;
  }

  composeErrorLogKey(appId, agentId, logPath) {
    const { ctx: { app: { config } } } = this;
    return `${config.errorLogKeyPrefix}${appId}::${agentId}::${logPath}`;
  }

  async updateAgentIdWithAppId(appId, agentId, agentserverIp) {
    const { ctx: { app: { redis, config } } } = this;
    const now = Date.now();
    await Promise.all([
      redis.hset(config.appListKey, appId, now),
      redis.hset(this.composeAgentListKey(appId), agentId, `${agentserverIp}`),
    ]);
  }

  async getInstancesByAppId(appId) {
    const { ctx: { app: { redis } } } = this;
    const list = await redis.hgetall(this.composeAgentListKey(appId));
    return list;
  }

  async deleteAgentWithAppId(appId, agentId) {
    const { ctx: { app: { redis, config } } } = this;
    await redis.hdel(`${config.agentListKeyPrefix}${appId}`, agentId);
    const length = await redis.hlen(`${config.agentListKeyPrefix}${appId}`);
    if (length === 0) {
      await redis.hdel(config.appListKey, appId);
    }
  }

  async saveErrorLogFile(appId, agentId, logPath) {
    const { ctx: { app: { redis } } } = this;

    // save error log file
    const errorLogFileKey = this.composeErrorLogFileKey(appId, agentId);
    await redis.sadd(errorLogFileKey, logPath);
  }

  async saveErrorLog(appId, agentId, logPath, log) {
    const { ctx: { app: { redis, config } } } = this;

    // save error log content
    const errorLogKey = this.composeErrorLogKey(appId, agentId, logPath);
    await redis.lpush(errorLogKey, JSON.stringify(log));
    await redis.ltrim(errorLogKey, 0, config.errorLogLimit - 1);

    // expired error log content
    const date = moment().add(config.saveDay, 'days');
    const timestamp = date.startOf('day').unix();
    await redis.expireat(errorLogKey, timestamp);
  }

  async getAgentErrorLogFiles(appId, agentId) {
    const { ctx: { app: { redis } } } = this;
    const errorLogFileKey = this.composeErrorLogFileKey(appId, agentId);
    const files = await redis.smembers(errorLogFileKey);
    const flags = {};

    // check file out of date
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const errorLogKey = this.composeErrorLogKey(appId, agentId, file);
      const exists = await redis.exists(errorLogKey);
      // if (!exists) {
      //   await redis.srem(errorLogFileKey, file);
      //   files.splice(i, 1);
      // }
      flags[file] = exists;
    }

    files.sort((o, n) => (!flags[o] && flags[n] ? 1 : -1));

    return files;
  }

  async getAgentErrorLog(appId, agentId, logPath, currentPage, pageSize) {
    const { ctx: { app: { redis } } } = this;
    const errorLogKey = this.composeErrorLogKey(appId, agentId, logPath);
    const count = await redis.llen(errorLogKey);
    const start = (currentPage - 1) * pageSize;
    const stop = currentPage * pageSize - 1;
    let logs = await redis.lrange(errorLogKey, start, stop);
    logs = logs.map(log => {
      try {
        log = JSON.parse(log);
        return log;
      } catch (err) {
        return null;
      }
    }).filter(log => log);

    return { count, logs };
  }
}

module.exports = RedisService;
