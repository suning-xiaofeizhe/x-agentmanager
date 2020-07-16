'use strict';

const path = require('path');

module.exports = appInfo => {
  const config = {};

  config.proxy = true;

  config.keys = appInfo.name + '_suning_xnpp_agentmanager';

  config.bodyParser = {
    jsonLimit: '10mb',
    formLimit: '10mb',
  };

  config.appListKey = 'XNODE_APP_LIST';

  config.agentListKeyPrefix = 'XNODE_AGENT_LIST::';

  config.errorLogFileKeyPrefix = 'XNODE_ERROR_LOG_FILE::';

  config.errorLogKeyPrefix = 'XNODE_ERROR_LOG::';

  config.errorLogLimit = 5000;

  config.saveDay = 3;

  config.security = {
    csrf: {
      ignore: ['/api/agentserver', '/api/front_end'],
    },
  };

  config.cleanProcessTable = 3;

  config.cleanAlarmTable = 3;

  config.cleanOsInfoTable = 3;

  config.profilingTime = 300;

  config.alarmLimitPrefix = 'XALARM_LIMIT';

  config.alarmSendLimit = {
    email: 20,
    sms: 20,
  };

  config.alarmGroupListPrefix = 'XALARM_GROUP_LIST';

  config.alarmGroupKeyPrefix = 'XALARM_GROUP_KEY';

  config.alarmGroupTime = 3 * 60;

  config.view = {
    mapping: { '.html': 'ejs' },
  };

  // user config
  config.mysql = {
    clients: {
      xnpp_dashboard: {
        host: '',
        port: '',
        user: '',
        password: '',
        database: '',
      },
      xnpp_logs: {
        host: '',
        port: '',
        user: '',
        password: '',
        database: '',
      },
    },
    app: true,
    agent: false,
  };

  config.redis = {
    client: {
      sentinels: [
        {
          port: 26379,
          host: '',
        },
        {
          port: 26379,
          host: '',
        },
        {
          port: 26379,
          host: '',
        },
      ],
      name: '',
      password: '',
      db: 0,
    },
  };

  config.linkUrlPrefix = 'http://127.0.0.1:6443/#';

  config.mailer = {
    client: {
      host: '',
      auth: {
        user: '',
        pass: '',
      },
    },
  };

  config.profiler = path.join(__dirname, '../../opensource-x-console/profiler');

  return config;
};
