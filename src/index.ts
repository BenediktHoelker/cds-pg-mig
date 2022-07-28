#!/usr/bin/env node

// https://itnext.io/how-to-create-your-own-typescript-cli-with-node-js-1faf7095ef89

import { program } from 'commander';
import { Client, ClientConfig } from 'pg';
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
const referenceDB = '_ref_db';

if (options.createDB) console.log('DB will be created');

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

async function connectToPG(database: string) {
  const clientConfig = getClientConfig();
  const client = new Client({ ...clientConfig, database });
  await client.connect();
  return client;
}

async function deploy() {
  await cds.connect();

  await updateReferenceDB();
  const diff = await getDatabaseDiff();
  console.log(diff);

  await updateSchema({ diff, schema: 'public' });
}

async function updateReferenceDB() {
  // connect to nameless DB as the reference-DB is not created yet
  let client = await connectToPG('');

  await client.query(`DROP DATABASE IF EXISTS ${referenceDB};`);
  await client.query(`CREATE DATABASE ${referenceDB};`);

  client.end();
  client = await connectToPG(referenceDB);

  const serviceInstance: any = cds.services['db'];
  const cdsModel = await cds.load(cds.env.requires['db'].model);

  const cdsSQL = cds.compile.to.sql(cdsModel) as unknown as string[];

  const query = cdsSQL.map((q) => serviceInstance.cdssql2pgsql(q)).join(' ');

  await client.query(query);
  client.end();
}

async function updateSchema({ diff, schema }) {
  const { database } = getClientConfig();
  const client = await connectToPG(database);
  await client.query(`SET search_path TO ${schema}; ${diff}`);
  client.end();
}

function getDatabaseDiff() {
  const clientConfig = getClientConfig();
  // how to specify schema: https://stackoverflow.com/questions/39460459/search-path-doesnt-work-as-expected-with-currentschema-in-url
  const originalDbURL = getDatabaseURL(clientConfig);
  const referenceDbURL = getDatabaseURL({
    ...clientConfig,
    database: referenceDB,
  });

  return new Promise((resolve, reject) => {
    exec(
      // Format of postgres-URL: postgresql://user:pw@host/database
      `migra --unsafe ${originalDbURL} ${referenceDbURL}`,
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

function getDatabaseURL({
  user,
  password,
  host,
  port = '5432',
  database,
  schema = 'public',
}: ClientConfig) {
  return `postgresql://${user}:${password}@${host}:${port}/${database}?options=-c%20search_path=${schema}`;
}

function getClientConfig() {
  const {
    credentials: { user, password, host, port, database, sslrootcert },
  } = cds.env.requires['db'];

  const clientConfig: ClientConfig = {
    user,
    password,
    host,
    port,
    database,
  };

  if (sslrootcert) {
    clientConfig.ssl = {
      rejectUnauthorized: false,
      ca: sslrootcert,
    };
  }

  return clientConfig;
}
