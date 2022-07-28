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
// const referenceDB = '_ref_db';

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

    await updateReferenceDB();
    const diff = await getDatabaseDiff();
    console.log(diff);

    await updateDB({ diff });
  } catch (error) {
    throw Error(error.message);
  }
}

async function updateReferenceDB() {
  const referenceDbURL = cds.env.requires['db'].credentials.referenceDbURL;
  const client = await connectToPG(referenceDbURL);

  const serviceInstance: any = cds.services['db'];
  const cdsModel = await cds.load(cds.env.requires['db'].model);

  const cdsSQL = cds.compile.to.sql(cdsModel) as unknown as string[];

  const query = cdsSQL.map((q) => serviceInstance.cdssql2pgsql(q)).join(' ');

  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query(query);
  client.end();
}

async function getDatabaseDiff() {
  // const clientConfig = getClientConfig();
  // how to specify schema: https://stackoverflow.com/questions/39460459/search-path-doesnt-work-as-expected-with-currentschema-in-url

  // DATABASE_URL is provided by Heroku
  const originalDbURL = cds.env.requires['db'].credentials.url;
  // SQLAlchemy (used by migra) supports only database-URLs in the form of 'postgresql://...'
  // https://stackoverflow.com/questions/62688256/sqlalchemy-exc-nosuchmoduleerror-cant-load-plugin-sqlalchemy-dialectspostgre
  // process.env.DATABASE_URL.replace('postgres://', 'postgresql://') ||
  // getDatabaseURL(clientConfig);

  const referenceDbURL = cds.env.requires['db'].credentials.referenceDbURL;
  // getDatabaseURL({
  //   ...clientConfig,
  //   database: referenceDB,
  // });

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

// function getDatabaseURL({
//   user,
//   password,
//   host,
//   port = '5432',
//   database,
// }: ClientConfig) {
//   return `postgresql://${user}:${password}@${host}:${port}/${database}`;
// }

// function getClientConfig() {
//   const {
//     credentials: { user, password, host, port, database, sslrootcert },
//   } = cds.env.requires['db'];

//   const clientConfig: ClientConfig = {
//     user,
//     password,
//     host,
//     port,
//     database,
//   };

//   if (sslrootcert) {
//     clientConfig.ssl = {
//       rejectUnauthorized: false,
//       ca: sslrootcert,
//     };
//   }

//   return clientConfig;
// }
