#!/usr/bin/env node

// https://itnext.io/how-to-create-your-own-typescript-cli-with-node-js-1faf7095ef89

import { program } from 'commander';
import { Client } from 'pg';
import chalk from 'chalk';
import clear from 'clear';
import figlet from 'figlet';
import cds from '@sap/cds';
import { exec } from 'child_process';

clear();

console.log(
  chalk.red(figlet.textSync('cds-pg-mig', { horizontalLayout: 'full' })),
);

program
  .version('0.0.1')
  .description('Deploy CDS to Postgres')
  .option('-c, --createDB', 'Create new database?')
  .parse(process.argv);

deploy();

const options = program.opts();

if (options.createDB) console.log('DB will be created');

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

async function connectToPG(url) {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function deploy() {
  try {
    await cds.connect();

    if (options.createDB) {
      // TODO: implement
    }

    await updateReferenceDB();
    const diff = await getDatabaseDiff();
    console.log(diff);

    await updateDB({ diff });
  } catch (error) {
    throw Error(error.message);
  }
}

async function updateReferenceDB() {
  const {
    credentials: { referenceDbURL },
    model: cdsModel,
  } = cds.env.requires['db'];

  const cdsSQL = cds.compile.to.sql(cdsModel) as unknown as string[];
  const serviceInstance: any = cds.services['db'];
  const query = cdsSQL.map((q) => serviceInstance.cdssql2pgsql(q)).join(' ');

  const client = await connectToPG(referenceDbURL);
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
  const originalDbURL = cds.env.requires['db'].credentials.url;
  const client = await connectToPG(originalDbURL);

  await client.query(diff);
  client.end();
}
