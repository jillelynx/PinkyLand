// Bundles the game into one file (game/pinkyland.js) so index.html works with a double-click.
import * as esbuild from 'esbuild';
const watch = process.argv.includes('--watch');
const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  outfile: 'game/pinkyland.js',
  loader: { '.glb': 'binary', '.css': 'text' },
  minify: !watch,
  sourcemap: false,
  target: ['safari16', 'chrome110'],
  logLevel: 'info',
};
if (watch) { const ctx = await esbuild.context(opts); await ctx.watch(); }
else await esbuild.build(opts);
