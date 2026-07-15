const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Only watch the /shared folder (not the entire parent workspace which has its own react-native)
config.watchFolders = [path.resolve(workspaceRoot, 'shared')];

// 2. Let Metro know where to find packages — mobile's node_modules FIRST
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// 3. Force Metro to resolve the @shared alias to the actual folder
config.resolver.extraNodeModules = {
  '@shared': path.resolve(workspaceRoot, 'shared'),
};

// 4. Block the parent's node_modules from being resolved
config.resolver.blockList = [
  new RegExp(path.resolve(workspaceRoot, 'node_modules').replace(/[/\\]/g, '[/\\\\]') + '.*'),
];

module.exports = config;
