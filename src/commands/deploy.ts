#!/usr/bin/env node
import childProcess from 'child_process';
import type { Arguments, CommandBuilder } from 'yargs';
import { config } from '../config.js';

type Options = {
  service: any;
  createDB: boolean | undefined;
};

const builder: CommandBuilder<Options> = (yargs) =>
  yargs.options({
    createDB: { type: 'boolean' },
  });

const handler = async (argv: Arguments<Options>) => {
  for (const service of argv.service) {
    const options = await config(service);

    console.log(options);
    console.log('Hi');
  }
};

function migra() {
  const { spawn } = childProcess;
  const pyProg = spawn('python', ['./../migra.py']);

  pyProg.stdout.on('data', function (data) {
    console.log(data.toString());
  });
}

export { builder, handler, migra };
