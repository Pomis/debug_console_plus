import esbuild from 'esbuild';
import { mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isWatch = process.argv.includes('--watch');

// Ensure out directory exists
const outDir = join(__dirname, 'out');
const webviewOutDir = join(outDir, 'webview');

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}
if (!existsSync(webviewOutDir)) {
  mkdirSync(webviewOutDir, { recursive: true });
}

// Copy webview files
function copyWebviewFiles() {
  const webviewSrcDir = join(__dirname, 'src', 'webview');
  const files = ['main.js', 'styles.css'];

  files.forEach((file) => {
    const src = join(webviewSrcDir, file);
    const dest = join(webviewOutDir, file);
    if (existsSync(src)) {
      copyFileSync(src, dest);
      console.log(`Copied ${file}`);
    }
  });
}

const extensionBuildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  logLevel: 'info',
};

const mcpServerBuildOptions = {
  entryPoints: ['src/mcpServer.ts'],
  bundle: true,
  outfile: 'out/mcpServer.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  logLevel: 'info',
  banner: {
    js: '#!/usr/bin/env node',
  },
};

async function build() {
  await Promise.all([
    esbuild.build(extensionBuildOptions),
    esbuild.build(mcpServerBuildOptions),
  ]);
  copyWebviewFiles();
  console.log('Build complete');
}

if (isWatch) {
  const extensionCtx = await esbuild.context(extensionBuildOptions);
  const mcpServerCtx = await esbuild.context(mcpServerBuildOptions);

  await Promise.all([
    extensionCtx.watch(),
    mcpServerCtx.watch(),
  ]);

  copyWebviewFiles();
  console.log('Watching for changes...');
  console.log('Note: Webview file changes require manual rebuild');
} else {
  await build();
}

