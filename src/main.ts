#!/usr/bin/env node
import childProcess from 'child_process';
import type { Arguments, CommandBuilder } from 'yargs';

type Options = {
  createDB: boolean | undefined;
};

export const command = 'greet <name>';
export const desc = 'Greet <name> with Hello';

export const builder: CommandBuilder<Options, Options> = (yargs) =>
  yargs
    .options({
      upper: { type: 'boolean' },
    })
    .positional('name', { type: 'string', demandOption: true });

export const handler = (argv: Arguments<Options>): void => {
  const { name, upper } = argv;
  const greeting = `Hello, ${name}!`;

  process.stdout.write(upper ? greeting.toUpperCase() : greeting);
  process.exit(0);
};

function migra() {
  const { spawn } = childProcess;
  const pyProg = spawn('python', ['./../migra.py']);

  pyProg.stdout.on('data', function (data) {
    console.log(data.toString());
  });
}

// Below are examples of using ESLint errors suppression
// Here it is suppressing a missing return type definition for the greeter function.

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export { migra };
