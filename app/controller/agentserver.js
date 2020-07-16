'use strict';

const moment = require('moment');
const Controller = require('egg').Controller;

class AgentServerController extends Controller {
  async heartbeat() {
    const { ctx, ctx: { logger, service: { redis } } } = this;
    const post = ctx.request.body;
    const appId = post.appId;
    const agentId = post.agentId;
    const heartbeatTime = post.timestamp;
    const agentserverIp = post.ip;
    if (Date.now() - heartbeatTime >= 3 * 60 * 1000) {
      const error = `${appId}: ${agentId} heartbeat expired: ${moment(heartbeatTime).format('YYYY-MM-DD HH:mm:ss')}, but now is: ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
      logger.error(error);
      ctx.body = { ok: false, message: error };
      return;
    }
    if (!appId || !agentId || !agentserverIp) {
      const error = 'appId, agentId and agentserverIp required!';
      logger.error(error);
      ctx.body = { ok: false, message: error };
      return;
    }
    await redis.updateAgentIdWithAppId(appId, agentId, agentserverIp);
    ctx.body = { ok: true };
  }

  async deleteAgent() {
    const { ctx, ctx: { service: { redis } } } = this;
    const post = ctx.request.body;
    const appId = post.appId;
    const agentId = post.agentId;
    await redis.deleteAgentWithAppId(appId, agentId);
    ctx.body = { ok: true };
  }

  async handleLog() {
    const { ctx, ctx: { service: { logHandle } } } = this;
    const post = ctx.request.body;
    const appId = post.appId;
    const agentId = post.agentId;
    const timestamp = post.timestamp;
    const log = post.log;
    const type = log.type;
    switch (type) {
      case 'node_log':
        logHandle.nodeLog.saveProcessMetrics(log.metrics, appId, agentId, timestamp);
        break;
      case 'system':
        logHandle.systemLog.saveSystemMetrics(log.metrics, appId, agentId, timestamp);
        break;
      case 'xagent_notification':
        logHandle.agentNotification.notice(log.metrics, appId, agentId, timestamp);
        break;
      case 'error_log':
        logHandle.errorLog.saveErrorLogs(log.metrics, appId, agentId);
        break;
      default:
        ctx.logger.error(`not support log type: ${type}`);
    }
    ctx.body = { ok: true };
  }
}

module.exports = AgentServerController;
