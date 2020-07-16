'use strict';

const pMap = require('p-map');
const moment = require('moment');
const Service = require('egg').Service;

const IMPORTANT = [
  'now', 'cpu_15', 'cpu_30', 'cpu_60',
  'rss', 'heap_used', 'heap_total', 'heap_limit',
  'new_space_size', 'new_space_used', 'new_space_available', 'new_space_committed',
  'old_space_size', 'old_space_used', 'old_space_available', 'old_space_committed',
  'code_space_size', 'code_space_used', 'code_space_available', 'code_space_committed',
  'map_space_size', 'map_space_used', 'map_space_available', 'map_space_committed',
  'lo_space_size', 'lo_space_used', 'lo_space_available', 'lo_space_committed',
  'active_handles', 'file_handles_inactive', 'tcp_handles_active', 'tcp_handles_inactive', 'udp_handles_active', 'udp_handles_inactive', 'timer_handles_active', 'timer_handles_inactive',
  'uptime', 'gc_time_during_last_min', 'total', 'scavange_duration', 'marksweep_duration', 'scavange_duration_total', 'marksweep_duration_total',
  'live_http_request', 'http_response_close', 'http_response_sent', 'http_request_timeout', 'http_patch_timeout', 'http_rt',
];

const IMPORTANT_OS_INFO = [
  'used_cpu', 'cpu_count', 'uptime',
  'totalmem', 'freemem',
  'load1', 'load5', 'load15',
  // 'disks',
  'node_count',
  'live_http_request', 'http_response_close', 'http_response_sent', 'http_request_timeout', 'http_patch_timeout', 'http_rt',
];

function createDayTables(prefix) {
  const tables = [];
  for (let i = 1; i < 32; i++) {
    tables.push({ Tables_in_xnpp_logs: `${[prefix]}${i < 10 ? `0${i}` : i}` });
  }
  return tables;
}

class MysqlService extends Service {
  async getSecretByAppId(appId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT secret from apps WHERE id = ?';
    const params = [appId];
    return xnpp_dashboard.query(sql, params).then(data => data[0] && data[0].secret);
  }

  async saveData(table, tpl, sql, params) {
    const { ctx: { logger, app: { mysql } } } = this;
    const xnpp_logs = mysql.get('xnpp_logs');
    try {
      await xnpp_logs.query(sql, params);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        logger.info(`create table in xnpp_logs ${table}`);
        try {
          await xnpp_logs.query(`CREATE TABLE ${table} LIKE ${tpl}`);
        } catch (err) {
          if (err.code === 'ER_TABLE_EXISTS_ERROR') {
            logger.info(`table ${table} already created by other process.`);
          }
        }
        await xnpp_logs.query(sql, params);
      } else {
        logger.error(`execute sql ${sql}, params ${params} falied: ${err}`);
      }
    }
  }

  async saveProcessData(data, pid, appId, agentId, created) {
    const { ctx: { logger } } = this;
    IMPORTANT.forEach(key => (data ? data[key] || (data[key] = 0) : ''));
    if (IMPORTANT.some(key => !data || !data.hasOwnProperty(key))) {
      logger.error(`[${appId}::${agentId}] ${JSON.stringify(data)} do not have some important key.`);
    }
    const table = `process_${moment().format('DD')}`;
    const sql = `INSERT INTO ${table} (app_id, agent_id, pid, created_time, ` +
      'cpu_now, cpu_15, cpu_30, cpu_60, ' +
      'rss, heap_used, heap_available, heap_total, heap_limit, heap_executeable, total_physical_size, malloced_memory, amount_of_external_allocated_memory, ' +
      'new_space_size, new_space_used, new_space_available, new_space_committed, ' +
      'old_space_size, old_space_used, old_space_available, old_space_committed, ' +
      'code_space_size, code_space_used, code_space_available, code_space_committed, ' +
      'map_space_size, map_space_used, map_space_available, map_space_committed, ' +
      'lo_space_size, lo_space_used, lo_space_available, lo_space_committed, ' +
      'active_handles, file_handles_active, file_handles_inactive, tcp_handles_active, tcp_handles_inactive, udp_handles_active, udp_handles_inactive, timer_handles_active, timer_handles_inactive, ' +
      'uptime, gc_time_during_last_min, total, scavange_duration, marksweep_duration, scavange_duration_total, marksweep_duration_total, ' +
      'http_response_code_map, live_http_request, http_response_close, http_response_sent, http_request_timeout, http_patch_timeout, http_rt) ' +
      'VALUES (?, ?, ?, ?, ' +
      '?, ?, ?, ?, ' +
      '?, ?, ?, ?, ?, ?, ?, ?, ?, ' +
      '?, ?, ?, ?, ' +
      '?, ?, ?, ?, ' +
      '?, ?, ?, ?, ' +
      '?, ?, ?, ?, ' +
      '?, ?, ?, ?, ' +
      '?, ?, ?, ?, ?, ?, ?, ?, ?, ' +
      '?, ?, ?, ?, ?, ?, ?, ' +
      '?, ?, ?, ?, ?, ?, ?)';
    const params = [
      appId, agentId, pid, moment(Number(created)).format('YYYY-MM-DD HH:mm:ss'),
      data.now, data.cpu_15, data.cpu_30, data.cpu_60,
      data.rss, data.heap_used, data.heap_available, data.heap_total, data.heap_limit, data.heap_executeable, data.total_physical_size, data.malloced_memory, data.amount_of_external_allocated_memory,
      data.new_space_size, data.new_space_used, data.new_space_available, data.new_space_committed,
      data.old_space_size, data.old_space_used, data.old_space_available, data.old_space_committed,
      data.code_space_size, data.code_space_used, data.code_space_available, data.code_space_committed,
      data.map_space_size, data.map_space_used, data.map_space_available, data.map_space_committed,
      data.lo_space_size, data.lo_space_used, data.lo_space_available, data.lo_space_committed,
      data.active_handles, data.file_handles_active, data.file_handles_inactive, data.tcp_handles_active, data.tcp_handles_inactive, data.udp_handles_active, data.udp_handles_inactive, data.timer_handles_active, data.timer_handles_inactive,
      data.uptime, data.gc_time_during_last_min, data.total, data.scavange_duration, data.marksweep_duration, data.scavange_duration_total, data.marksweep_duration_total,
      data.http_response_code_map || '', data.live_http_request, data.http_response_close, data.http_response_sent, data.http_request_timeout, data.http_patch_timeout, data.http_rt,
    ];
    await this.saveData(table, 'process', sql, params);
  }

  async saveOsInfo(data, disks = '', appId, agentId, created) {
    const { ctx: { logger } } = this;
    IMPORTANT_OS_INFO.forEach(key => (data ? data[key] || (data[key] = 0) : ''));
    if (IMPORTANT_OS_INFO.some(key => !data || !data.hasOwnProperty(key))) {
      logger.error(`[${appId}::${agentId}] ${JSON.stringify(data)} do not have some important os info key.`);
    }
    if (disks.length > 250) {
      disks = disks.slice(0, 250);
    }
    const table = `osinfo_${moment().format('DD')}`;
    const sql = `INSERT INTO ${table} (app_id, agent_id, created_time, ` +
      'used_cpu, cpu_count, uptime, ' +
      'totalmem, freemem, ' +
      'load1, load5, load15, ' +
      'disks, ' +
      'node_count, ' +
      'http_response_code_map, live_http_request, http_response_close, http_response_sent, http_request_timeout, http_patch_timeout, http_rt) ' +
      'VALUES (?, ?, ?, ' +
      '?, ?, ?, ' +
      '?, ?, ' +
      '?, ?, ?, ' +
      '?, ' +
      '?, ' +
      '?, ?, ?, ?, ?, ?, ?)';
    const params = [appId, agentId, moment(Number(created)).format('YYYY-MM-DD HH:mm:ss'),
      data.used_cpu, data.cpu_count, data.uptime,
      data.totalmem, data.freemem,
      data.load1, data.load5, data.load15,
      disks,
      data.node_count,
      data.http_response_code_map || '', data.live_http_request, data.http_response_close, data.http_response_sent, data.http_request_timeout, data.http_patch_timeout, data.http_rt,
    ];
    await this.saveData(table, 'osinfo', sql, params);
  }

  async addAlarmMessage(strategyId, agentId, message, pid) {
    const table = `alarm_${moment().format('DD')}`;
    const sql = `INSERT INTO ${table} (strategy_id, agent_id, message, pid) ` +
      'VALUES (?, ?, ?, ?)';
    if (message.length > 200) {
      message = message.slice(0, 195) + '...';
    }
    const params = [strategyId, agentId, message, pid];
    await this.saveData(table, 'alarm', sql, params);
  }

  async cleanOldTable(prefix, expired) {
    const { ctx: { logger, app: { mysql } } } = this;
    const remains = [];
    const now = Date.now();
    for (let i = 0; i < expired; i++) {
      remains.push(`${prefix}${moment(now - i * 24 * 3600 * 1000).format('DD')}`);
    }
    const xnpp_logs = mysql.get('xnpp_logs');
    // const tables = await xnpp_logs.query('SHOW TABLES FROM xnpp_logs', []);
    const tables = createDayTables(prefix);
    await pMap(tables, async column => {
      const tableName = column.Tables_in_xnpp_logs;
      if (tableName.startsWith(prefix) && !remains.includes(tableName)) {
        try {
          // await xnpp_logs.query(`TRUNCATE TABLE ${tableName}`);
          // await xnpp_logs.query(`DROP TABLE ${tableName}`);
          await xnpp_logs.query(`DELETE FROM ${tableName}`);
          await xnpp_logs.query(`OPTIMIZE TABLE ${tableName}`);
        } catch (err) {
          logger.error(`truncate or drop & optimize table ${tableName} failed: ${err}, ignore it.`);
        }
      }
    }, { concurrency: 5 });
  }

  async cleanOldProcessTable() {
    const { ctx: { app: { config } } } = this;
    await this.cleanOldTable('process_', config.cleanProcessTable);
  }

  async cleanOldAlarmTable() {
    const { ctx: { app: { config } } } = this;
    await this.cleanOldTable('alarm_', config.cleanAlarmTable);
  }

  async cleanOldOsInfoTable() {
    const { ctx: { app: { config } } } = this;
    await this.cleanOldTable('osinfo_', config.cleanOsInfoTable);
  }

  async createProcessTable() {
    // const { ctx: { logger, app: { mysql } } } = this;
    // const table = `process_${moment().format('DD')}`;
    // logger.info(`create table ${table} by schedule.`);
    // const xnpp_logs = mysql.get('xnpp_logs');
    // try {
    //   await xnpp_logs.query(`CREATE TABLE ${table} LIKE process`);
    // } catch (err) {
    //   if (err.code === 'ER_TABLE_EXISTS_ERROR') {
    //     logger.info(`${table} has already created, ignore it.`);
    //   } else {
    //     logger.error(`create ${table} failed: ${err}.`);
    //   }
    // }
  }

  async createAlarmRecordTable() {
    // const { ctx: { logger, app: { mysql } } } = this;
    // const table = `alarm_${moment().format('DD')}`;
    // logger.info(`create table ${table} by schedule.`);
    // const xnpp_logs = mysql.get('xnpp_logs');
    // try {
    //   await xnpp_logs.query(`CREATE TABLE ${table} LIKE alarm`);
    // } catch (err) {
    //   if (err.code === 'ER_TABLE_EXISTS_ERROR') {
    //     logger.info(`${table} has already created, ignore it.`);
    //   } else {
    //     logger.error(`create ${table} failed: ${err}.`);
    //   }
    // }
  }

  async getStrategiesByAppIdAndContextType(appId, contextType) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT * FROM strategies WHERE app_id = ? AND context_type = ? AND status = 1';
    const params = [appId, contextType];
    return xnpp_dashboard.query(sql, params);
  }

  async getStrategyMembers(strategyId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT work_id FROM strategy_members WHERE strategy_id = ?';
    const params = [strategyId];
    return xnpp_dashboard.query(sql, params);
  }

  async getGlobalStrategyMembers(strategyId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT work_id FROM global_strategy_members WHERE strategy_id = ?';
    const params = [strategyId];
    return xnpp_dashboard.query(sql, params);
  }

  async getPackageInfo(appId, agentId, packageName) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT * FROM package WHERE app_id = ? AND agent_id = ? AND package_name = ?';
    const params = [appId, agentId, packageName];
    return xnpp_dashboard.query(sql, params).then(data => data[0]);
  }

  async recordPackageInfo(appId, agentId, packageName, packagePath, packageLockPath, securityPath) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'INSERT INTO package '
      + '(app_id, agent_id, package_name, package_path, package_lock_path, security_path) VALUES (?, ?, ?, ?, ?, ?) '
      + 'ON DUPLICATE KEY UPDATE package_path = ?, package_lock_path=?, security_path = ?';
    const params = [appId, agentId, packageName,
      packagePath, packageLockPath, securityPath, packagePath, packageLockPath, securityPath];
    return xnpp_dashboard.query(sql, params);
  }

  async deletePackageInfo(id) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'DELETE FROM package WHERE id = ?';
    const params = [id];
    return xnpp_dashboard.query(sql, params);
  }

  async getGlobalStrategies(contextType) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT * FROM global_strategies WHERE context_type = ? AND status = 1';
    const params = [contextType];
    return xnpp_dashboard.query(sql, params);
  }

  async addGlobalAlarmMessage(strategyId, appId, agentId, message, pid) {
    const table = `global_alarm_${moment().format('DD')}`;
    const sql = `INSERT INTO ${table} (strategy_id, app_id, agent_id, message, pid) ` +
      'VALUES (?, ?, ?, ?, ?)';
    if (message.length > 200) {
      message = message.slice(0, 195) + '...';
    }
    const params = [strategyId, appId, agentId, message, pid];
    await this.saveData(table, 'global_alarm', sql, params);
  }

  async getUserInfoById(workId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT * FROM user WHERE work_id = ?';
    const params = [workId];
    return xnpp_dashboard.query(sql, params).then(data => data[0]);
  }
}

module.exports = MysqlService;
