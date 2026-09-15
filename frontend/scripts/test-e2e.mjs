#!/usr/bin/env node
/**
 * e2e 测试入口：自动检测 Chromium 运行所需的系统库，无需手工改命令。
 *
 * - 系统库完整：直接运行 playwright test；
 * - 系统库缺失但存在用户态补库（默认 ~/.local/pw-libs/root，可用 PW_LIBS_ROOT 覆盖）：
 *   自动接入 LD_LIBRARY_PATH 后运行；
 * - 仍缺失：列出具体缺失项与恢复方式，退出码 1。
 *
 * 用法：npm run test:e2e [-- <playwright 参数>]
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

function log(message) {
  console.log(`[test:e2e] ${message}`);
}

function resolvePlaywrightCli() {
  // cli.js 不在包 exports 中，需通过 package.json 定位包根目录
  for (const id of ['playwright/package.json', '@playwright/test/package.json']) {
    try {
      const cli = join(dirname(require.resolve(id)), 'cli.js');
      if (existsSync(cli)) {
        return cli;
      }
    } catch {
      // 尝试下一个候选
    }
  }
  return null;
}

/** Playwright 浏览器缓存根目录（尊重 PLAYWRIGHT_BROWSERS_PATH） */
function browsersDir() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    return process.env.PLAYWRIGHT_BROWSERS_PATH;
  }
  try {
    const { chromium } = require('@playwright/test');
    // 可执行文件位于 <browsersDir>/chromium-XXXX/<arch>/chrome，向上三级即到缓存根目录
    return dirname(dirname(dirname(chromium.executablePath())));
  } catch {
    return join(homedir(), '.cache', 'ms-playwright');
  }
}

/** 在浏览器缓存中定位 chromium / chrome-headless-shell 可执行文件 */
function findChromiumExecutables(dir) {
  const executables = [];
  if (!existsSync(dir)) {
    return executables;
  }
  for (const entry of readdirSync(dir)) {
    if (!/^chromium(_headless_shell)?-\d+/.test(entry)) {
      continue;
    }
    const packageDir = join(dir, entry);
    for (const sub of readdirSync(packageDir)) {
      for (const binary of ['chrome-headless-shell', 'chrome']) {
        const candidate = join(packageDir, sub, binary);
        if (existsSync(candidate)) {
          executables.push(candidate);
        }
      }
    }
  }
  return executables;
}

/** 返回可执行文件缺失的共享库列表；ldd 不可用时返回 null */
function missingLibs(executable, extraEnv = {}) {
  try {
    const out = execFileSync('ldd', [executable], {
      env: { ...process.env, ...extraEnv },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out
      .split('\n')
      .filter((line) => line.includes('not found'))
      .map((line) => line.trim().split(/\s+/)[0]);
  } catch {
    return null;
  }
}

function collectMissing(executables, extraEnv = {}) {
  const missing = new Set();
  for (const executable of executables) {
    const result = missingLibs(executable, extraEnv);
    if (result === null) {
      return null;
    }
    result.forEach((lib) => missing.add(lib));
  }
  return [...missing];
}

/** 用户态补库目录（usr/lib|lib/<arch>-linux-gnu 布局） */
function collectLocalLibDirs() {
  const root = process.env.PW_LIBS_ROOT ?? join(homedir(), '.local', 'pw-libs', 'root');
  const dirs = [];
  for (const sub of ['usr/lib', 'lib']) {
    const base = join(root, sub);
    if (!existsSync(base)) {
      continue;
    }
    for (const entry of readdirSync(base)) {
      if (entry.endsWith('-linux-gnu')) {
        dirs.push(join(base, entry));
      }
    }
  }
  return dirs;
}

function reportMissing(missing) {
  console.error('');
  console.error('[test:e2e] Chromium 启动所需的系统库缺失：');
  for (const lib of missing) {
    console.error(`  ✗ ${lib}`);
  }
  console.error('');
  console.error('恢复方式（任选其一）：');
  console.error('  1. 有 root 权限：sudo npx playwright install-deps chromium');
  console.error('  2. 无 root 权限（用户态补库，无需修改命令）：bash scripts/provision-test-libs.sh');
  console.error('  3. 库已在非默认位置：PW_LIBS_ROOT=<库根目录> npm run test:e2e');
}

function run(extraEnv) {
  const cli = resolvePlaywrightCli();
  if (!cli) {
    console.error('[test:e2e] 未找到 playwright CLI，请先执行 npm install');
    process.exit(1);
  }
  const child = spawn(process.execPath, [cli, 'test', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  child.on('exit', (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });
}

if (platform() !== 'linux') {
  // macOS / Windows：浏览器自带依赖，直接运行
  run({});
} else {
  const executables = findChromiumExecutables(browsersDir());
  if (executables.length === 0) {
    console.error('[test:e2e] 未找到 Chromium，请先运行：npx playwright install chromium');
    process.exit(1);
  }

  const missing = collectMissing(executables);
  if (missing === null) {
    log('ldd 不可用，跳过系统库检测');
    run({});
  } else if (missing.length === 0) {
    log('系统库检测通过');
    run({});
  } else {
    const libDirs = collectLocalLibDirs();
    const stillMissing = libDirs.length > 0 ? collectMissing(executables, { LD_LIBRARY_PATH: libDirs.join(':') }) : missing;
    if (stillMissing !== null && stillMissing.length === 0) {
      log(`系统缺少 ${missing.length} 个库，已自动接入用户态补库：${libDirs.join(':')}`);
      run({ LD_LIBRARY_PATH: libDirs.join(':') });
    } else {
      reportMissing(stillMissing ?? missing);
      process.exit(1);
    }
  }
}
