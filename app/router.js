'use strict';

module.exports = app => {
  const { router } = app;

  // from agentserver
  router.post('/api/agentserver/heartbeat', 'agentserver.heartbeat');
  router.post('/api/agentserver/agent_close', 'agentserver.deleteAgent');
  router.post('/api/agentserver/log', 'agentserver.handleLog');

  // from front_end
  router.get('/api/front_end/instance_count', 'front.getInstanceCount');
  router.get('/api/front_end/instances', 'front.getInstances');
  router.get('/api/front_end/instance_node_processes', 'front.getInstanceNodeProcesses');
  router.get('/api/front_end/node_process_status', 'front.checkProcessStatus');
  router.get('/api/front_end/node_processes_status', 'front.checkProcessesStatus');
  router.get('/api/front_end/os_info', 'front.getOsInfo');
  router.post('/api/front_end/take_action', 'front.takeAction');
  router.get('/api/front_end/check_file', 'front.checkFile');
  router.post('/api/front_end/transfer', 'front.transfer');
  router.get('/api/front_end/agent_error_log_files', 'front.getAgentErrorLogFiles');
  router.get('/api/front_end/agent_error_log', 'front.getAgentErrorLog');
};
