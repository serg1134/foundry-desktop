import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  main:{plugins:[externalizeDepsPlugin()],build:{rollupOptions:{external:['electron-builder']}}},preload:{plugins:[externalizeDepsPlugin()],build:{rollupOptions:{input:{index:resolve('src/preload/index.ts'),runtime:resolve('src/preload/runtime.ts')},output:{format:'cjs',entryFileNames:'[name].cjs'}}}},
  renderer:{root:'.',resolve:{alias:{'@renderer':resolve('src')}},plugins:[react()],build:{rollupOptions:{input:{main:resolve('index.html'),splash:resolve('splash.html')}}}}
});
