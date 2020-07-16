'use strict';

const pMap = require('p-map');
const Service = require('egg').Service;

class AgentService extends Service {
  getServerIp(str) {
    return str;
  }

  getAgentKey(appId, agentId) {
    return `${appId}::${agentId}`;
  }

  async getInstance(appId) {
    const { ctx: { service: { redis, agentserver } } } = this;
    const list = await redis.getInstancesByAppId(appId);
    if (!Object.keys(list).length) {
      return [];
    }
    const checkList = {};
    Object.entries(list).forEach(([agentId, serverIp]) => {
      const key = `${appId}::${agentId}`;
      const ip = serverIp;
      if (Array.isArray(checkList[ip])) {
        checkList[ip].push(key);
      } else {
        checkList[ip] = [key];
      }
    });
    const params = Object.entries(checkList);
    const res = await pMap(params,
      async ([serverIp, agentList]) => agentserver.checkAgentAlive(serverIp, agentList),
      { concurrency: 5 });
    let resList = [];
    for (const r of res) {
      resList = resList.concat(r);
    }
    resList = resList.filter(item => item && item.agentKey !== undefined && item.alive !== undefined);
    const results = [];
    await pMap(resList, async item => {
      const tmp = item.agentKey.split('::');
      if (item.alive) {
        results.push(tmp[1]);
      } else {
        const appId = tmp[0];
        const agentId = tmp[1];
        await redis.deleteAgentWithAppId(appId, agentId);
      }
    }, { concurrency: 5 });
    return results;
  }

  async getExecCommandsArgs(appId, agentId) {
    const { ctx: { logger, service: { redis, mysql } } } = this;
    try {
      const agents = await redis.getInstancesByAppId(appId);
      if (!agents[agentId]) {
        return null;
      }
      const secret = await mysql.getSecretByAppId(appId);
      if (!secret) {
        return null;
      }
      const serverIp = this.getServerIp(agents[agentId]);
      const agentKey = this.getAgentKey(appId, agentId);
      return { serverIp, agentKey, secret };
    } catch (err) {
      logger.error(err);
      return null;
    }
  }

  async getInstanceNodeProcesses(appId, agentId) {
    const { ctx: { logger, service: { agentserver } } } = this;
    try {
      const { serverIp, agentKey, secret } = await this.getExecCommandsArgs(appId, agentId);
      const processes = await agentserver.getInstanceProcesses(serverIp, agentKey, secret);
      return { xagent: true, processes };
    } catch (err) {
      logger.error(err);
      return { xagent: false, processes: [] };
    }
  }

  async checkProcessStatus(appId, agentId, pid) {
    const { ctx: { service: { agentserver } } } = this;
    const { serverIp, agentKey, secret } = await this.getExecCommandsArgs(appId, agentId);
    return agentserver.checkProcessStatus(serverIp, agentKey, secret, { pid });
  }

  async checkProcessesStatus(appId, agentId, pids) {
    const { ctx: { service: { agentserver } } } = this;
    const { serverIp, agentKey, secret } = await this.getExecCommandsArgs(appId, agentId);
    return agentserver.checkProcessesStatus(serverIp, agentKey, secret, { pids });
  }

  async getOsInfo(appId, agentId) {
    const { ctx: { service: { agentserver } } } = this;
    const { serverIp, agentKey, secret } = await this.getExecCommandsArgs(appId, agentId);
    return agentserver.getOsInfo(serverIp, agentKey, secret);
  }

  async takeAction(appId, agentId, pid, action) {
    const { ctx: { service: { agentserver } } } = this;
    const { serverIp, agentKey, secret } = await this.getExecCommandsArgs(appId, agentId);
    return agentserver.takeAction(serverIp, agentKey, secret, { pid, action });
  }

  async checkFile(appId, agentId, file) {
    const { ctx: { service: { agentserver } } } = this;
    const { serverIp, agentKey, secret } = await this.getExecCommandsArgs(appId, agentId);
    return agentserver.checkFile(serverIp, agentKey, secret, { file });
  }

  async transfer(appId, agentId, filePath, uploadServer, token, fileId, fileType, timeout) {
    const { ctx: { service: { agentserver } } } = this;
    const { serverIp, agentKey, secret } = await this.getExecCommandsArgs(appId, agentId);
    return agentserver.transfer(serverIp, agentKey, secret, { filePath, uploadServer, token, fileId, fileType, timeout });
  }
}

module.exports = AgentService;
