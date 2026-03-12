import * as esbuild from 'esbuild';

await esbuild.build({
    entryPoints: ['./index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    outdir: 'dist',
    minify: true,
    sourcemap: false,
    metafile: true,
    logLevel: 'info',
});

console.log('Build completed!');