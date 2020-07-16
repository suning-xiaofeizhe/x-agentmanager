'use strict';

const Service = require('egg').Service;
const pMap = require('p-map');

class AgentNotification extends Service {
  async notice(metrics, appId, agentId) {
    if (metrics.ok && metrics.data) {
      const { ctx: { service: { alarm, package: packageService } } } = this;
      const data = metrics.data;
      // node process exit occured
      if (data.node_process_exit) {
        await alarm.checkRule(appId, agentId, 'xagent_notification',
          Object.assign({ agent_id: agentId, node_process_exit: true }, data.node_process_exit), true);
      }

      // package info
      if (Array.isArray(data.packages)) {
        await pMap(data.packages, async pkg => {
          const security = await packageService.checkPackageSecurity(appId, agentId, pkg);
          await alarm.checkRule(appId, agentId, 'xagent_notification',
            Object.assign({ agent_id: agentId }, security), true);
        }, { concurrency: 5 });
      }
    }
  }
}

module.exports = AgentNotification;
