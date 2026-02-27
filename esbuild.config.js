const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

// Build the main plugin code
const buildPlugin = {
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  target: 'es2017',
  format: 'iife',
};

// Copy UI file to dist
function copyUI() {
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }
  fs.copyFileSync('src/ui.html', 'dist/ui.html');
  console.log('UI copied to dist/');
}

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildPlugin);
      await ctx.watch();
      console.log('Watching for changes...');
      // Watch UI file
      fs.watchFile('src/ui.html', () => {
        copyUI();
        console.log('UI updated');
      });
    } else {
      await esbuild.build(buildPlugin);
      console.log('Build complete');
    }
    copyUI();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

build();
