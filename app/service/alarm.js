'use strict';

const boolex = require('boolex');
const contextex = require('contextex');
const moment = require('moment');
const Service = require('egg').Service;

const boolexMap = new Map();
const contextexMap = new Map();

class AlarmService extends Service {
  async groupAlarmMessage(data, content, appId, agentId, strategy, type, immediate, global) {
    const { ctx: { app: { config, redis } } } = this;
    const strategyId = strategy.id;
    const alarmGroupKey = `${config.alarmGroupKeyPrefix}::${appId}::${strategyId}::${agentId}::${type}`;
    const lock = immediate || await redis.setnx(alarmGroupKey, config.alarmGroupTime);
    const alarmGroupListKey = `${config.alarmGroupListPrefix}::${appId}::${strategyId}::${agentId}::${type}`;
    const time = moment().format('YYYY-MM-DD HH:mm:ss');
    const storeData = JSON.stringify({ time, content });
    // get the lock
    if (lock) {
      await redis.expire(alarmGroupKey, config.alarmGroupTime);
      const list = await redis.lrange(alarmGroupListKey, 0, -1);
      await redis.del(alarmGroupListKey);
      list.push(storeData);
      // compose alarm message
      const contextType = strategy.context_type;
      let instanceTab = '';
      switch (contextType) {
        case 'node_log':
          instanceTab = 'process';
          break;
        case 'system_log':
          instanceTab = 'system';
          break;
        case 'error_log':
          instanceTab = 'error';
          break;
        case 'xagent_notification':
          if (['@critical', '@high', '@moderate', '@low'].some(key => strategy.dsl.includes(key))) {
            instanceTab = 'package';
          }
          break;
        default:
          instanceTab = 'process';
          break;
      }
      list.sort((o, n) => {
        const oldEle = JSON.parse(o);
        const newEle = JSON.parse(n);
        const oldTime = new Date(oldEle.time);
        const newTime = new Date(newEle.time);
        return oldTime > newTime ? 1 : -1;
      });
      const length = list.length;
      const start = JSON.parse(list[0]);
      const stop = JSON.parse(list[length - 1]);
      let period = '';
      if (length === 1) {
        period = `${start.time}`;
      } else {
        period = `${start.time} ~ ${stop.time}`;
      }

      let linkurl = `${config.linkUrlPrefix}/app/${appId}/agent?` +
        `instanceTab=${instanceTab}&agentId=${agentId}`;
      switch (instanceTab) {
        case 'error':
          linkurl += `&selectErrorLog=${data.log_path}`;
          break;
        default:
          linkurl += `${data.pid ? `&selectPid=${data.pid}&showProcessDetailDrawer=1` : ''}`;
          break;
      }

      const message = (global ? '<全局告警> ' : '') + '您的应用 ' +
        `${appId} 在实例 ${agentId} 于 ${period} 发生 ${length} 条告警: ${content}，` +
        `点击 ${linkurl} 查看详细信息。`;
      return { message, list, linkurl, data: { appId, agentId, period, content } };
    }
    if (!immediate) {
      await redis.lpush(alarmGroupListKey, storeData);
      await redis.expire(alarmGroupListKey, config.alarmGroupTime + 15);
    }
  }

  async shouldSendMessage(data, content, appId, agentId, strategy, type, immediate, global) {
    const { ctx: { app: { config, redis }, logger, service: { mysql, alarm } } } = this;
    const strategyId = strategy.id;
    // get contacts
    let contacts = [];
    if (global) {
      contacts = await mysql.getGlobalStrategyMembers(strategyId);
    } else {
      contacts = await mysql.getStrategyMembers(strategyId);
    }
    if (!contacts.length) {
      return null;
    }
    // get group alarm message
    const groupResults = await alarm.groupAlarmMessage(data, content, appId, agentId, strategy, type, immediate, global);
    if (!groupResults) {
      return null;
    }
    // need send alarm message
    const alarmSendLimit = config.alarmSendLimit;
    const limitTimes = alarmSendLimit[type];
    if (!limitTimes) {
      logger.error(`alarm type ${type} not configure sending message limits per day`);
      return null;
    }
    const date = moment().format('YYYYMMDD');
    const limitKey = `${config.alarmLimitPrefix}::${appId}::${strategyId}::${type}::${date}`;
    const sendTimes = await redis.incr(limitKey);
    if (sendTimes > limitTimes) {
      logger.error(`alarm [${limitKey}] exceeded, today limit is ${limitTimes}, not sending.`);
      return null;
    }
    const tadayRemain = parseInt((moment().endOf('day') - moment()) / 1000) + 60;
    await redis.expire(limitKey, tadayRemain);
    return { contacts, groupResults };
  }

  async checkUserRule(appId, agentId, contextType, data, immediate) {
    const { ctx: { service: { mysql, mail } } } = this;
    const strategies = await mysql.getStrategiesByAppIdAndContextType(appId, contextType);
    for (const strategy of strategies) {
      let needSendAlarmMessage = false;
      const cacheBoolexFn = boolexMap.get(strategy.dsl);
      if (typeof cacheBoolexFn === 'function') {
        needSendAlarmMessage = cacheBoolexFn(data);
      } else {
        const fn = boolex.compile(strategy.dsl);
        boolexMap.set(strategy.dsl, fn);
        needSendAlarmMessage = fn(data);
      }
      if (needSendAlarmMessage) {
        const priority = strategy.push_type;
        let content = '';
        const cacheContextFn = contextexMap.get(strategy.expr);
        if (typeof cacheContextFn === 'function') {
          content = cacheContextFn(data);
        } else {
          const fn = contextex.compile(strategy.expr);
          contextexMap.set(strategy.expr, fn);
          content = fn(data);
        }
        const tasks = [];
        switch (priority) {
          case 'p3':
            tasks.push(mysql.addAlarmMessage(strategy.id, agentId, content, data.pid));
            tasks.push(mail.alarm(data, content, appId, agentId, strategy, 'email', immediate));
            break;
          case 'p4':
            tasks.push(mysql.addAlarmMessage(strategy.id, agentId, content, data.pid));
            break;
          default:
            break;
        }
        await Promise.all(tasks);
      }
    }
  }

  async checkGlobalRule(appId, agentId, contextType, data, immediate) {
    const { ctx: { service: { mysql, mail } } } = this;
    const strategies = await mysql.getGlobalStrategies(contextType);
    for (const strategy of strategies) {
      let needSendAlarmMessage = false;
      const cacheBoolexFn = boolexMap.get(strategy.dsl);
      if (typeof cacheBoolexFn === 'function') {
        needSendAlarmMessage = cacheBoolexFn(data);
      } else {
        const fn = boolex.compile(strategy.dsl);
        boolexMap.set(strategy.dsl, fn);
        needSendAlarmMessage = fn(data);
      }
      if (needSendAlarmMessage) {
        const priority = strategy.push_type;
        let content = '';
        const cacheContextFn = contextexMap.get(strategy.expr);
        if (typeof cacheContextFn === 'function') {
          content = cacheContextFn(data);
        } else {
          const fn = contextex.compile(strategy.expr);
          contextexMap.set(strategy.expr, fn);
          content = fn(data);
        }
        const tasks = [];
        switch (priority) {
          case 'p3':
            tasks.push(mysql.addGlobalAlarmMessage(strategy.id, appId, agentId, content, data.pid));
            tasks.push(mail.alarm(data, content, appId, agentId, strategy, 'email', immediate, true));
            break;
          case 'p4':
            tasks.push(mysql.addGlobalAlarmMessage(strategy.id, appId, agentId, content, data.pid));
            break;
          default:
            break;
        }
        await Promise.all(tasks);
      }
    }
  }

  async checkRule(...args) {
    const tasks = [];
    tasks.push(this.checkUserRule(...args));
    tasks.push(this.checkGlobalRule(...args));

    await Promise.all(tasks);
  }
}
module.exports = AlarmService;
