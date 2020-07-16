'use strict';

const Service = require('egg').Service;

const processRegexp = /^(\d+) (.*)$/;

class AgentServerService extends Service {
  async checkAgentAlive(ip, agentIdList) {
    const { ctx } = this;
    try {
      const res = await ctx.curl(`http://${ip}/api/check_alive`,
        { method: 'POST', data: { agentIdList }, nestedQuerystring: true });
      let data = res.data.toString();
      data = JSON.parse(data);
      if (!data.ok) {
        ctx.logger.error(data.message);
        return {};
      }
      return data.data;
    } catch (err) {
      ctx.logger.error(err);
      return agentIdList.map(agent => ({ agentKey: agent, alive: false }));
    }
  }

  async execCommand(command, ip, agentKey, secret, timeout = 15) {
    const { ctx } = this;
    const res = await ctx.curl(`http://${ip}/api/exec_command`,
      {
        method: 'POST',
        data: {
          agentKey,
          secret,
          command,
          timeout,
        },
        timeout: timeout * 1000,
      });
    let data = res.data.toString();
    try {
      data = JSON.parse(data);
    } catch (err) {
      ctx.logger.error(`json parse error, raw string: ${data}`);
      throw err;
    }
    return data;
  }

  async getInstanceProcesses(ip, agentKey, secret) {
    const { ctx } = this;
    const command = 'get_node_processes';
    const res = await this.execCommand(command, ip, agentKey, secret);
    if (!res.ok) {
      ctx.logger.error(res.message);
      return [];
    }
    const { stdout } = res.data;
    let list = stdout.split('\n');
    list = list.map(proc => {
      const parts = processRegexp.exec(proc.trim());
      if (parts) {
        return {
          pid: parts[1],
          command: parts[2],
        };
      }
      return null;
    }).filter(proc => proc);
    return list;
  }

  async checkProcessStatus(ip, agentKey, secret, params) {
    const command = `check_node_process ${params.pid}`;
    return this.execCommand(command, ip, agentKey, secret);
  }

  async checkProcessesStatus(ip, agentKey, secret, params) {
    const command = `check_node_processes ${params.pids}`;
    return this.execCommand(command, ip, agentKey, secret);
  }

  async getOsInfo(ip, agentKey, secret) {
    const command = 'get_os_info';
    return this.execCommand(command, ip, agentKey, secret);
  }

  async takeAction(ip, agentKey, secret, params) {
    const { ctx: { app: { config } } } = this;
    const profilingTime = config.profilingTime;
    const action = params.action;
    let command = '';
    switch (action) {
      case 'cpu_profiling':
        command = `xkill --start_profiling ${profilingTime} ${params.pid}`;
        break;
      case 'heapdump':
        command = `xkill --heapdump ${params.pid}`;
        break;
      case 'heap_profiling':
        command = `xkill --start_heap_profiling ${profilingTime} ${params.pid}`;
        break;
      case 'gc_tracing':
        command = `xkill --start_gc_tracing ${profilingTime} ${params.pid}`;
        break;
      case 'diag_report':
        command = `xkill --diag_report ${params.pid}`;
        break;
      default:
        return { ok: false, message: `not support action: ${action}` };
    }
    return this.execCommand(command, ip, agentKey, secret);
  }

  async checkFile(ip, agentKey, secret, params) {
    const command = `check_file ${params.file}`;
    return this.execCommand(command, ip, agentKey, secret);
  }

  async transfer(ip, agentKey, secret, params) {
    const command = `upload_file ${params.uploadServer} ${params.filePath} ${params.token} ${params.fileId} ${params.fileType}`;
    return this.execCommand(command, ip, agentKey, secret, params.timeout);
  }
}

module.exports = AgentServerService;
