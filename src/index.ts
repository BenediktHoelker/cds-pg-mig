#!/usr/bin/env node

// https://itnext.io/how-to-create-your-own-typescript-cli-with-node-js-1faf7095ef89

import { DataLoader } from './DataLoader';
import { program } from 'commander';
import { Client } from 'pg';
import chalk from 'chalk';
import clear from 'clear';
import figlet from 'figlet';
import cds from '@sap/cds';
// import path from 'path';
import { exec } from 'child_process';
import fs from 'fs';

import ConnectionParameters = require('pg/lib/connection-parameters');

clear();

console.log(
  chalk.red(figlet.textSync('cds-pg-mig', { horizontalLayout: 'full' })),
);

program
  .version('0.0.1')
  .description('Deploy CDS to Postgres')
  .option('-c, --createDB', 'Create new database?')
  .option(
    '-d, --deltaUpdate',
    'Load delta of initial data (y) or overwrite all data (n)?',
  )
  .parse(process.argv);

deploy();

const options = program.opts();

if (options.createDB) console.log('DB will be created');

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

async function connectToPG({ url, ssl }) {
  const client = new Client({
    connectionString: url,
    ssl,
  });
  await client.connect();
  return client;
}

async function getCdsModel() {
  const { model } = cds.env.requires['db'];

  const cdsModel = await cds.load(model);
  return cdsModel;
}

async function deploy() {
  // const {
  //   credentials: { url },
  // } = cds.env.requires['db'];
  // const connectionParams = new ConnectionParameters(url);

  await cds.connect();
  const model = await getCdsModel();

  if (options.createDB) {
    // TODO: implement
  }

  await updateReferenceDB(model);
  const diff = await getDatabaseDiff();

  logToFile(diff);

  await updateDB({ diff });

  await loadData(model);
}

async function loadData(model) {
  const loader = new DataLoader(model, options.deltaUpdate);

  const {
    credentials: { url, ssl },
  } = cds.env.requires['db'];
  const client = await connectToPG({ url, ssl });

  await loader.load(client);
  client.end();
}

function logToFile(diff) {
  if (!diff) return;

  const {
    credentials: { url },
  } = cds.env.requires['db'];
  const connectionParams = new ConnectionParameters(url);
  const dir = 'db_changelogs/' + connectionParams.database;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(`./${dir}/` + Date.now() + '.sql', diff.toString(), 'utf8');
}

async function updateReferenceDB(model) {
  const {
    credentials: { referenceDbURL, ssl },
  } = cds.env.requires['db'];

  const cdsSQL = cds.compile.to.sql(model) as unknown as string[];
  const serviceInstance: any = cds.services['db'];
  const query = cdsSQL.map((q) => serviceInstance.cdssql2pgsql(q)).join(' ');

  const client = await connectToPG({ url: referenceDbURL, ssl });
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query(query);
  client.end();
}

async function getDatabaseDiff() {
  const {
    credentials: { referenceDbURL, url: originalDbURL },
  } = cds.env.requires['db'];

  return new Promise((resolve, reject) => {
    exec(
      // Format of postgres-URL: postgresql://user:pw@host/database
      `migra --unsafe --schema public ${originalDbURL} ${referenceDbURL}`,
      (_, stdout, stderr) => {
        // error is always defined, even though the request was succesful => dont use it (cf https://github.com/nodejs/node-v0.x-archive/issues/4590)
        // if (error) {
        //   console.log(`error: ${error.message}`);
        //   return;
        // }
        if (stderr) {
          return reject(stderr);
        }
        return resolve(stdout);
      },
    );
  });
}

async function updateDB({ diff }) {
  const {
    credentials: { url, ssl },
  } = cds.env.requires['db'];
  const client = await connectToPG({ url, ssl });

  await client.query(diff);
  client.end();
}
