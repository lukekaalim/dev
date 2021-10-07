#!/bin/env node
// @flow strict
import { promises } from 'fs';
import { join, dirname } from 'path';
import { spawn } from 'child_process';
const { readFile, writeFile } = promises;

/*::
type Command = {
  name: string,
  helpText: string,
  handler: (...string[]) => Promise<void> | void,
};
*/

const parseOpts = (opts)/*: { [string]: string }*/ => {
  return opts
    .reduce/*:: <{ [string]: string }>*/((acc, curr, i) => i % 2 === 0 ? { ...acc, [curr]: opts[i + 1]} : acc, {});
};

const versionCommand = {
  name: 'version',
  helpText: `usage: shelf version (major | minor | patch) [(-w | --workspace) $path_to_workspace_package]
Updates the package json, pushes a git tag, and updates all packages in the current workspace that depend on this one to the latest.`,
  async handler(type, ...opts) {
    const options = parseOpts(opts);
    const workspace = options['-w'] || options['--workspace'] || '.';

    const targetPackagePath = join(workspace, 'package.json');

    const { name, version } = JSON.parse(await readFile(targetPackagePath, 'utf8'));

    const child = spawn('git', ['add', '.'], { stdio: ['ignore', 'inherit', 'inherit'] })
    child.addListener('exit', () => console.log('done!'));
    //throw new Error(`Not Implemented!`)
  }

};
const helpCommand = {
  name: 'help',
  helpText: `Print some useful text.`,
  async handler(commandName = null) {
    if (!commandName) {
      const shelfPackagePath = join(dirname(new URL((import.meta/*: any*/).url).pathname), 'package.json');
      const { name, version, description } = JSON.parse(await readFile(shelfPackagePath, 'utf8'));
      console.log(`${name}@${version}`);
      console.log(description);
      console.log(`Commands: ${commands.map(c => c.name).join(', ')}`);
      console.log('Run shelf help $command for more info on a command')
      return;
    } 
    const command = commands.find(c => c.name === commandName.toLowerCase());
    if (!command)
      throw new Error(`Unknown command ${commandName}. Can't help you there!`)
    console.log(command.helpText);
  }
};

const updateCommand = {
  name: 'upgrade',
  helpText: `usage: shelf upgrade $package_path\nFor every workspace pacakge that depends on $package_path, it will be set to ^$latest_version`,
  async handler(package_path) {
    const { name: upgradedPackageName, version: upgradedVersion } = JSON.parse(await readFile(join(package_path, 'package.json'), 'utf8'));

    const { workspaces: packageDirs = [] } = JSON.parse(await readFile('package.json', 'utf8'));
    for (const packageDir of packageDirs) {
      if (packageDir === package_path)
        continue;
      const packagePath = join(packageDir, 'package.json');
      const { dependencies = {}, ...restOfPackage } = JSON.parse(await readFile(packagePath, 'utf8'));
      if (!dependencies[upgradedPackageName] || dependencies[upgradedPackageName] == `^${upgradedVersion}`)
        continue;
      const updatedDependencies = {
        ...dependencies,
        [upgradedPackageName]: `^${upgradedVersion}`
      };
      console.log(packageDir, dependencies[upgradedPackageName], `=>`, `^${upgradedVersion}`);
      await writeFile(packagePath, JSON.stringify({ ...restOfPackage, dependencies: updatedDependencies }, null, 2), 'utf-8');
    }
  }
}

const commands = [
  //versionCommand,
  helpCommand,
  updateCommand
];

const main = (commandName = 'help', ...options) => {
  try {
    const command = commands.find(c => c.name === commandName.toLowerCase());
    if (!command)
      throw new Error(`Unknown command: ${commandName}`)
    command.handler(...options);
  } catch (error) {
    console.error(error.message);
  }
};

main(...process.argv.slice(2));