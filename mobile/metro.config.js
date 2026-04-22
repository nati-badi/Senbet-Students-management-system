const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the workspace root (including /shared)
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to find packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force Metro to resolve the @shared alias to the actual folder
config.resolver.extraNodeModules = {
  '@shared': path.resolve(workspaceRoot, 'shared'),
  'react-native-reanimated/plugin': path.resolve(projectRoot, 'node_modules/react-native-reanimated/plugin'),
  'react-native-worklets/plugin': path.resolve(projectRoot, 'node_modules/react-native-worklets/plugin'),
};

module.exports = config;
