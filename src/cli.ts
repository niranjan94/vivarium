#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { compose } from './commands/compose.js';
import { mcpProxy } from './commands/mcp-proxy.js';
import { setup } from './commands/setup.js';
import { start } from './commands/start.js';
import { status } from './commands/status.js';
import { stop } from './commands/stop.js';
import { teardown } from './commands/teardown.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'),
);

const program = new Command();

program
  .name('vivarium')
  .description(
    'Local dev stack manager — auto-allocates ports, manages Docker Compose services, generates .env files',
  )
  .version(pkg.version);

program
  .command('setup')
  .description(
    'Auto-claim index, spin up services, generate .env files, run post-setup scripts',
  )
  .action(() => {
    setup(process.cwd());
  });

program
  .command('teardown')
  .description('Stop services, release index, clean up generated files')
  .action(() => {
    teardown(process.cwd());
  });

program
  .command('start')
  .description('Start compose services (no setup logic)')
  .action(() => {
    start(process.cwd());
  });

program
  .command('stop')
  .description('Stop compose services (no teardown logic)')
  .action(() => {
    stop(process.cwd());
  });

program
  .command('status')
  .description('Show project state, assigned ports, and container status')
  .action(() => {
    status(process.cwd());
  });

program
  .command('compose')
  .description('Pass-through to docker compose with generated config')
  .allowUnknownOption()
  .allowExcessArguments()
  .action((_options, cmd) => {
    compose(process.cwd(), cmd.args);
  });

program
  .command('mcp-proxy <service>')
  .description('stdio→SSE bridge for an MCP service (e.g. postgres-mcp)')
  .action((service) => {
    mcpProxy(process.cwd(), service);
  });

program.parse();
