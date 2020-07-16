'use strict';

const Controller = require('egg').Controller;

class FrontController extends Controller {
  async getInstanceCount() {
    const { ctx, ctx: { service: { agent } } } = this;
    const appId = ctx.query.appId;
    const instances = await agent.getInstance(appId);
    ctx.body = { ok: true, data: { count: instances.length } };
  }

  async getInstances() {
    const { ctx, ctx: { service: { agent } } } = this;
    const appId = ctx.query.appId;
    const instances = await agent.getInstance(appId);
    ctx.body = { ok: true, data: { list: instances } };
  }

  async getInstanceNodeProcesses() {
    const { ctx, ctx: { service: { agent } } } = this;
    const appId = ctx.query.appId;
    const agentId = ctx.query.agentId;
    const data = await agent.getInstanceNodeProcesses(appId, agentId);
    ctx.body = { ok: true, data };
  }

  async checkProcessStatus() {
    const { ctx, ctx: { service: { agent } } } = this;
    const appId = ctx.query.appId;
    const agentId = ctx.query.agentId;
    const pid = ctx.query.pid;
    ctx.body = await agent.checkProcessStatus(appId, agentId, pid);
  }

  async checkProcessesStatus() {
    const { ctx, ctx: { service: { agent } } } = this;
    const appId = ctx.query.appId;
    const agentId = ctx.query.agentId;
    const pids = ctx.queries.pids;
    if (!Array.isArray(pids) || !pids.length) {
      ctx.body = { ok: false, message: 'pids mustn\'t to be an empty array' };
      return;
    }
    ctx.body = await agent.checkProcessesStatus(appId, agentId, pids.join(' '));
  }

  async getOsInfo() {
    const { ctx, ctx: { service: { agent } } } = this;
    const appId = ctx.query.appId;
    const agentId = ctx.query.agentId;
    ctx.body = await agent.getOsInfo(appId, agentId);
  }

  async takeAction() {
    const { ctx, ctx: { service: { agent } } } = this;
    const post = ctx.request.body;
    const appId = post.appId;
    const agentId = post.agentId;
    const pid = post.pid;
    const action = post.action;
    ctx.body = await agent.takeAction(appId, agentId, pid, action);
  }

  async checkFile() {
    const { ctx, ctx: { service: { agent } } } = this;
    const appId = ctx.query.appId;
    const agentId = ctx.query.agentId;
    const file = ctx.query.file;
    ctx.body = await agent.checkFile(appId, agentId, file);
  }

  async transfer() {
    const { ctx, ctx: { service: { agent } } } = this;
    const post = ctx.request.body;
    const appId = post.appId;
    const agentId = post.agentId;
    const filePath = post.filePath;
    const uploadServer = post.uploadServer;
    const token = post.token;
    const fileId = post.fileId;
    const fileType = post.fileType;
    const timeout = post.timeout;
    ctx.body = await agent.transfer(appId, agentId, filePath, uploadServer, token, fileId, fileType, timeout);
  }

  async getAgentErrorLogFiles() {
    const { ctx, ctx: { service: { redis } } } = this;
    const appId = ctx.query.appId;
    const agentId = ctx.query.agentId;
    const errorLogFiles = await redis.getAgentErrorLogFiles(appId, agentId);
    ctx.body = { ok: true, data: { errorLogFiles } };
  }

  async getAgentErrorLog() {
    const { ctx, ctx: { service: { redis } } } = this;
    const appId = ctx.query.appId;
    const agentId = ctx.query.agentId;
    const errorLogPath = ctx.query.errorLogPath;
    const currentPage = ctx.query.currentPage;
    const pageSize = ctx.query.pageSize;
    const data = await redis.getAgentErrorLog(appId, agentId, errorLogPath, currentPage, pageSize);
    ctx.body = { ok: true, data };
  }
}

module.exports = FrontController;
