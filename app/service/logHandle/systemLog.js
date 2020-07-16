'use strict';

const Service = require('egg').Service;

class SystemService extends Service {
  serializeDisks(disks) {
    if (!disks) return '';
    return Object.entries(disks).map(([disk, usage]) => {
      return `${disk}::${usage}`;
    }).join('\u0000');
  }

  async saveSystemMetrics(metrics, appId, agentId, timestamp) {
    const { ctx: { service: { mysql, alarm } } } = this;
    const tasks = [];
    const disks = this.serializeDisks(metrics.disks);
    tasks.push(mysql.saveOsInfo(metrics, disks, appId, agentId, timestamp));

    const osCpuUsage = metrics.used_cpu ? Number((metrics.used_cpu * 100).toFixed(2)) : 0;
    const osMemUsage = metrics.totalmem && metrics.freemem ?
      Number(((metrics.totalmem - metrics.freemem) / metrics.totalmem * 100).toFixed(2)) : 0;
    tasks.push(alarm.checkRule(appId, agentId, 'system_log', Object.assign({
      os_cpu_usage: osCpuUsage,
      os_mem_usage: osMemUsage,
    }, metrics)));

    // disk usage
    if (metrics.disks) {
      Object.entries(metrics.disks).forEach(([disk, usage]) => {
        tasks.push(alarm.checkRule(appId, agentId, 'system_log', {
          mounted_on: disk,
          disk_usage: Number(usage),
        }));
      });
    }

    // http status
    const http_response_code_map = {};
    try {
      const tmp = JSON.parse(metrics.http_response_code_map);
      for (const [code, count] of Object.entries(tmp)) {
        // 4xx
        if (Number(code) >= 400 && Number(code) < 500) {
          if (http_response_code_map.code_4xx) {
            http_response_code_map.code_4xx += count;
          } else {
            http_response_code_map.code_4xx = count;
          }
        }

        // 5xx
        if (Number(code) >= 500 && Number(code) < 600) {
          if (http_response_code_map.code_5xx) {
            http_response_code_map.code_5xx += count;
          } else {
            http_response_code_map.code_5xx = count;
          }
        }
      }
    } catch (err) {
      err;
    }
    tasks.push(alarm.checkRule(appId, agentId, 'system_log', {
      http_response_sent: metrics.http_response_sent || 0,
      expired_request: metrics.http_request_timeout || 0,
      code_4xx: http_response_code_map.code_4xx || 0,
      code_5xx: http_response_code_map.code_5xx || 0,
    }));

    await Promise.all(tasks);
  }
}

module.exports = SystemService;
