'use strict';

// When Foundry's Electron binary runs as Node, yargs otherwise receives this
// wrapper path as an application argument. Remove it before loading the
// packager so CI and local qualification can invoke electron-builder directly
// without a command interpreter.
if(process.versions.electron){
  process.noAsar=true;
  process.argv.splice(1,1);
}
require('electron-builder/out/cli/cli.js');
