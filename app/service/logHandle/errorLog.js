'use strict';

const Service = require('egg').Service;

class ErrorLogService extends Service {
  async saveErrorLogs(metrics, appId, agentId) {
    const { ctx: { service: { redis, alarm } } } = this;
    if (!Array.isArray(metrics)) {
      return;
    }
    for (const errorLog of metrics) {
      const logPath = errorLog.path;
      await redis.saveErrorLogFile(appId, agentId, logPath);

      const logs = errorLog.logs;
      if (!Array.isArray(logs)) {
        continue;
      }
      for (const content of logs) {
        const tasks = [];
        tasks.push(redis.saveErrorLog(appId, agentId, logPath, content));
        tasks.push(alarm.checkRule(appId, agentId, 'error_log',
          Object.assign({ agent_id: agentId, error_type: content.type, log_path: logPath }, content)));
        await Promise.all(tasks);
      }
    }
  }
}

module.exports = ErrorLogService;
