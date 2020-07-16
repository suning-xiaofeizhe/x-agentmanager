'use strict';

const pMap = require('p-map');
const Service = require('egg').Service;

class MailService extends Service {
  async sendMessage(groupResults, params, title = 'XNPP 性能监控平台') {
    if (!params.tolist.length) {
      return;
    }

    const { ctx, ctx: { app: { mailer, config: { mailer: { client: { auth } } } } } } = this;
    const html = await ctx.renderView('mail', groupResults);
    mailer.sendMail({
      from: auth.user,
      to: params.tolist.join(','),
      subject: title,
      // text: content,
      html,
    });
  }

  async alarm(...args) {
    const { ctx: { service: { mail, alarm, mysql } } } = this;
    const results = await alarm.shouldSendMessage(...args);
    if (results) {
      const groupResults = results.groupResults;
      const contacts = results.contacts;
      const tolist = await pMap(contacts, async ({ work_id }) => {
        const user = await mysql.getUserInfoById(work_id);
        if (user) {
          return user.mail;
        }
        return null;
      }, { concurrency: 2 });
      await mail.sendMessage(groupResults, {
        tolist: tolist.filter(mail => mail),
      });
    }
  }
}

module.exports = MailService;
