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

if (options.createDB) console.log('DB will be created');

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

async function deploy() {
  await cds.connect();
  const clientConfig = getClientConfig();
  const client = new Client(clientConfig);
  await client.connect();

  await updateReferenceSchema({ client });
  const diff = await getDatabaseDiff({ clientConfig });
  await updateSchema({ client, diff, schema: 'public' });

  client.end();
}

async function updateReferenceSchema({ client }) {
  const referenceSchema = '_ref';

  await client.query(
    `DROP SCHEMA IF EXISTS ${referenceSchema} CASCADE; 
     CREATE SCHEMA ${referenceSchema};
     SET search_path TO ${referenceSchema};`,
  );

  const serviceInstance: any = cds.services['db'];
  const cdsModel = await cds.load(cds.env.requires['db'].model);

  const cdsSQL = cds.compile.to.sql(cdsModel) as unknown as string[];

  const query = cdsSQL.map((q) => serviceInstance.cdssql2pgsql(q)).join(' ');

  await client.query(query);
}

async function updateSchema({ client, diff, schema }) {
  await client.query(`SET search_path TO ${schema}; ${diff}`);
}

function getDatabaseDiff({ clientConfig }) {
  // how to specify schema: https://stackoverflow.com/questions/39460459/search-path-doesnt-work-as-expected-with-currentschema-in-url
  const initialSchemaURL = getDatabaseURL(clientConfig);
  const targetSchemaURL = getDatabaseURL({ ...clientConfig, schema: '_ref' });

  return new Promise((resolve, reject) => {
    exec(
      // Format of postgres-URL: postgresql://user:pw@host/database
      `migra ${initialSchemaURL} ${targetSchemaURL}`,
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
  schema,
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
    schema: 'public',
  };

  if (sslrootcert) {
    clientConfig.ssl = {
      rejectUnauthorized: false,
      ca: sslrootcert,
    };
  }

  return clientConfig;
}
