// Metro-Config für den Monorepo-Betrieb: Metro muss auch das Workspace-Root
// (packages/core) beobachten und dort nach Modulen suchen, damit @paceforge/core
// direkt aus dem TS-Quellcode aufgelöst und transpiliert wird.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1) Auch das Monorepo-Root beobachten (für packages/core).
config.watchFolders = [workspaceRoot];

// 2) Module sowohl lokal als auch im gehoisteten Root-node_modules suchen.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3) package.json "exports" beachten, damit @paceforge/core/fit aufgeloest wird.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
