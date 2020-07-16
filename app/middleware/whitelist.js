'use strict';

const ip = require('ip');

module.exports = whiteList => {
  return async function checkWhitelist(ctx, next) {
    const clientIp = ctx.ip;
    if (whiteList.some(whiteip => ip.isEqual(whiteip, clientIp))) {
      await next();
    } else {
      ctx.body = { ok: false, message: `${clientIp} 没有访问权限` };
    }
  };
};
