'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const promisify = require('util').promisify;
const mkdir = promisify(fs.mkdir);
const exits = promisify(fs.exists);
const writeFile = promisify(fs.writeFile);
// const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);
const exec = promisify(cp.exec);
const uuid = require('uuid/v4');
const Service = require('egg').Service;

class PackageService extends Service {
  isValidJson(str) {
    if (!str) {
      return false;
    }
    const { ctx } = this;
    try {
      JSON.parse(str);
      return true;
    } catch (err) {
      ctx.logger.error(
        `raw string: ${typeof str === 'object' ? JSON.stringify(str) : str}, json parse error: ${err.stack}`
      );
      return false;
    }
  }

  async cleanFileIsExists(file) {
    if (await exits(file)) {
      await unlink(file);
    }
  }

  async createTmpdir(appId, agentId) {
    const tmpdir = path.join(os.tmpdir(), `${uuid()}-${appId}-${agentId}`);
    const packageTmpfile = path.join(tmpdir, 'package.json');
    const packageLockTmpfile = path.join(tmpdir, 'package-lock.json');
    if (!await exits(tmpdir)) {
      await mkdir(tmpdir, { recursive: true });
    } else {
      await Promise.all([
        this.cleanFileIsExists(packageTmpfile),
        this.cleanFileIsExists(packageLockTmpfile),
      ]);
    }
    return { tmpdir, packageTmpfile, packageLockTmpfile };
  }

  async cleanTmpdir(tmpdir, packageTmpfile, packageLockTmpfile) {
    await Promise.all([
      this.cleanFileIsExists(packageTmpfile),
      this.cleanFileIsExists(packageLockTmpfile),
    ]);
    await rmdir(tmpdir);
  }

  async audit(appId, agentId, packageContent, packageLockContent) {
    const { ctx } = this;

    // create tmp dir
    const { tmpdir, packageTmpfile, packageLockTmpfile } = await this.createTmpdir(appId, agentId);

    // write package.json & package-lock.json
    await Promise.all([
      writeFile(packageTmpfile, packageContent),
      writeFile(packageLockTmpfile, packageLockContent),
    ]);

    // get secruit info
    let security = '';
    try {
      const options = { cwd: tmpdir, env: process.env, maxBuffer: 20 * 1024 * 1024, timeout: 15 * 1000 };
      // await exec(`npm install`, options);
      const result = await exec('npm audit --json --production', options);
      const stderr = result.stderr.toString().trim();
      if (stderr) {
        ctx.logger.error(stderr);
      } else {
        const stdout = result.stdout.toString().trim();
        if (this.isValidJson(stdout)) {
          security = stdout;
        }
      }
    } catch (err) {
      const stdout = err.stdout;
      if (typeof stdout === 'string' && this.isValidJson(stdout) && !err.stderr) {
        security = stdout.trim();
      } else {
        this.ctx.logger.error(err);
      }
    }

    // clean tmp file
    await this.cleanTmpdir(tmpdir, packageTmpfile, packageLockTmpfile);

    return security;
  }

  async checkPackageSecurity(appId, agentId, pkg) {
    const { ctx: { service: { mysql }, app: { oss } } } = this;
    const packageContent = pkg.package;
    const packageName = JSON.parse(packageContent).name;
    const packageLockContent = pkg.packageLock;
    // let packageLockContent = null;

    // create lock file if not exits
    if (!packageLockContent) {
      // create tmp dir
      // const { tmpdir, packageTmpfile, packageLockTmpfile } = await this.createTmpdir(appId, agentId);

      // create lock file
      // await writeFile(packageTmpfile, packageContent);
      // await exec(
      //   'export npm_config_cache=$(mktemp -d) && ' +
      //   'npm install --package-lock-only ; ' +
      //   'rm -rf $npm_config_cache', { cwd: tmpdir, env: process.env });
      // if (await exits(packageLockTmpfile)) {
      //   packageLockContent = await readFile(packageLockTmpfile, 'utf8');
      // }

      // clean tmp file
      // await this.cleanTmpdir(tmpdir, packageTmpfile, packageLockTmpfile);
    }

    let securityContent = '';
    if (packageLockContent) {
      // create security message
      // securityContent = await this.audit(appId, agentId, packageContent, packageLockContent);
    }

    // delete old file
    const oldData = await mysql.getPackageInfo(appId, agentId, packageName);
    if (oldData) {
      const deleteOssTasks = [];
      if (packageContent && oldData.package_path) {
        deleteOssTasks.push(oss.deleteObject(oldData.package_path));
      }
      if (packageLockContent && oldData.package_lock_path) {
        deleteOssTasks.push(oss.deleteObject(oldData.package_lock_path));
      }
      if (securityContent && oldData.security_path) {
        deleteOssTasks.push(oss.deleteObject(oldData.security_path));
      }
      await Promise.all(deleteOssTasks);
    }

    // put to oss
    const packageFileName = `u-${uuid()}-u-package.json`;
    let packageLockFileName = '';
    let securityFileName = '';
    const ossTasks = [oss.uploadBigObject(packageFileName, Buffer.from(packageContent))];
    if (packageLockContent) {
      packageLockFileName = `u-${uuid()}-u-package-lock.json`;
      ossTasks.push(oss.uploadBigObject(packageLockFileName, Buffer.from(packageLockContent)));
    }
    if (securityContent) {
      securityFileName = `u-${uuid()}-u-package-audit.json`;
      ossTasks.push(oss.uploadBigObject(securityFileName, Buffer.from(securityContent)));
    }
    await Promise.all(ossTasks);

    // save filepath to mysql
    await mysql.recordPackageInfo(appId, agentId, packageName, packageFileName, packageLockFileName, securityFileName);

    // calculate security info
    const result = {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      info: 0,
    };
    if (securityContent) {
      try {
        securityContent = JSON.parse(securityContent);
      } catch (err) {
        err;
      }
      if (securityContent) {
        for (const action of securityContent.actions) {
          action.resolves = action.resolves.filter(resolve => !resolve.dev);
        }
        const validActions = securityContent.actions.filter(action => action.resolves.length);

        const advisories = securityContent.advisories;
        for (const validAction of validActions) {
          if (Array.isArray(validAction.resolves)) {
            for (const resolve of validAction.resolves) {
              if (advisories[resolve.id]) {
                const severity = advisories[resolve.id].severity;
                if (result[severity]) {
                  result[severity]++;
                } else {
                  result[severity] = 1;
                }
              }
            }
          }
        }
      }
    }
    return result;
  }
}

module.exports = PackageService;
