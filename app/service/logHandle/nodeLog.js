'use strict';
const pMap = require('p-map');
const Service = require('egg').Service;

class NodeLogService extends Service {
  agentHttpStatus(total) {
    const httpStatus = {
      http_response_code_map: {},
      live_http_request: 0,
      http_response_close: 0,
      http_response_sent: 0,
      http_request_timeout: 0,
      http_patch_timeout: 0,
      http_rt: 0,
    };
    Object.entries(total).forEach(([, data]) => {
      httpStatus.live_http_request += Number(data.live_http_request);
      httpStatus.http_response_close += Number(data.http_response_close);
      httpStatus.http_response_sent += Number(data.http_response_sent);
      httpStatus.http_request_timeout += Number(data.http_request_timeout);
      httpStatus.http_patch_timeout = Number(data.http_patch_timeout);
      httpStatus.http_rt += Number(data.http_rt) * Number(data.http_response_sent);

      const http_response_code_map = data.http_response_code_map;
      for (const [res_code, count] of Object.entries(http_response_code_map)) {
        if (httpStatus.http_response_code_map[res_code]) {
          httpStatus.http_response_code_map[res_code] += count;
        } else {
          httpStatus.http_response_code_map[res_code] = count;
        }
      }
    });

    httpStatus.http_rt = Number((httpStatus.http_rt / httpStatus.http_response_sent).toFixed(2));
    httpStatus.http_response_code_map = JSON.stringify(httpStatus.http_response_code_map);

    return httpStatus;
  }

  async saveProcessMetrics(metrics, appId, agentId, timestamp) {
    const { service: { logHandle: { systemLog } } } = this;

    if (metrics.ok && metrics.data) {
      const { ctx: { service: { mysql, alarm } } } = this;
      metrics = metrics.data;
      const total = Object.entries(metrics).reduce((res, args) => {
        const data = args[1];
        const pid = data.pid;
        if (res[pid]) {
          if (data.item.startsWith('res__')) {
            res[pid].http_response_code_map[data.item.replace('res__', '')] = data.value;
          } else {
            res[pid][data.item] = data.value;
          }
        } else {
          if (data.item.startsWith('res__')) {
            res[pid] = { http_response_code_map: { [data.item.replace('res__', '')]: data.value } };
          } else {
            res[pid] = { [data.item]: data.value, http_response_code_map: {} };
          }
        }
        return res;
      }, {});

      // save agent http status
      const agentHttpStatus = this.agentHttpStatus(total);
      await systemLog.saveSystemMetrics(agentHttpStatus, appId, agentId, timestamp);

      pMap(Object.entries(total), async ([pid, data]) => {
        data.http_response_code_map = JSON.stringify(data.http_response_code_map);
        const tasks = [];
        tasks.push(alarm.checkRule(appId, agentId, 'node_log', Object.assign({ pid }, data)));
        tasks.push(mysql.saveProcessData(data, pid, appId, agentId, timestamp));
        await Promise.all(tasks);
      }, { concurrency: 5 });
    }
  }
}

module.exports = NodeLogService;
