#!/usr/bin/env node
import childProcess from 'child_process';
import type { Arguments, CommandBuilder } from 'yargs';
import { config } from '../config.js';

type Options = {
  service: any;
  name: string;
  upper: boolean | undefined;
};

const command = 'greet <name>';
const desc = 'Greet <name> with Hello';

const builder: CommandBuilder<Options, Options> = (yargs) =>
  yargs
    .options({
      upper: { type: 'boolean' },
    })
    .positional('name', { type: 'string', demandOption: true });

const handler = async (argv: Arguments<Options>) => {
  for (const service of argv.service) {
    const options = await config(service);
  }
};

function migra() {
  const { spawn } = childProcess;
  const pyProg = spawn('python', ['./../migra.py']);

  pyProg.stdout.on('data', function (data) {
    console.log(data.toString());
  });
}

export { command, desc, builder, handler, migra };
