#!/usr/bin/env node

// https://itnext.io/how-to-create-your-own-typescript-cli-with-node-js-1faf7095ef89

import { program } from 'commander';
import chalk from 'chalk';
import clear from 'clear';
import figlet from 'figlet';
// import path from 'path';

clear();

console.log(
  chalk.red(figlet.textSync('cds-pg-mig', { horizontalLayout: 'full' })),
);

program
  .version('0.0.1')
  .description('Deploy CDS to Postgres')
  .option('-c, --create-DB', 'Create new database?')
  .parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
