#!/usr/bin/env node

const path = require('path'),
      fs = require('fs');

function get(name, obj, key) {
  const val = key.split('.').reduce((acc, next) => {
    const sofar = [...acc.sofar, next];
    if (next in acc.current) {
      return {current: acc.current[next], sofar: sofar};
    } else {
      throw `${name} doesn't contain property '${sofar.join(".")}'`;
    }
  }, {current: obj, sofar: []});
  return val.current;
}

const plugin = 'tw5-gemini-plugin';

const packageJsonPath = 'package.json';
const pluginInfoPath = `src/plugins/${plugin}/plugin.info`;
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', packageJsonPath)));
const pluginInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', pluginInfoPath)));

const mustMatch = [
  {
    message: 'Package/plugin versions must match',
    packageJson: 'version',
    pluginInfo: 'version',
  },
  {
    message: 'TiddlyWiki versions must match',
    packageJson: 'peerDependencies.tiddlywiki',
    pluginInfo: 'core-version',
  },
];

const hasMismatch = mustMatch.reduce((acc, match) => {
  try {
    const packageValue = get(packageJsonPath, packageJson, match.packageJson);
    const pluginValue = get(pluginInfoPath, pluginInfo, match.pluginInfo);
    if (packageValue !== pluginValue) {
      console.error(`${match.message}: '${match.packageJson}' of ${packageJsonPath} is ${packageValue} while ${match.pluginInfo} of ${pluginInfoPath} is ${pluginValue}`);
      return acc || true;
    } else {
      return acc || false;
    }
  } catch(e) {
    console.error(e);
    return acc || true;
  }
}, false);

process.exit(hasMismatch ? 1 : 0);
