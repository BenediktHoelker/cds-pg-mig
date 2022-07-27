#!/usr/bin/env node

// https://itnext.io/how-to-create-your-own-typescript-cli-with-node-js-1faf7095ef89

import { program } from 'commander';
import chalk from 'chalk';
import clear from 'clear';
import figlet from 'figlet';
// import cds from '@sap/cds';

import { exec } from 'child_process';

function migra() {
  exec(
    `migra postgresql://postgres:postgres@localhost/projectplanning1 postgresql://postgres:postgres@localhost/projectplanning6`,
    (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
    },
  );
}

clear();

console.log(
  chalk.red(figlet.textSync('cds-pg-mig', { horizontalLayout: 'full' })),
);

program
  .version('0.0.1')
  .description('Deploy CDS to Postgres')
  .option('-c, --createDB', 'Create new database?')
  .parse(process.argv);

migra();

const options = program.opts();

if (options.createDB) console.log('DB will be created');

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
