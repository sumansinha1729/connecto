// Production refuses to start with settings that are only safe on a laptop
import { check } from './helpers';

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';

const serverDir = path.resolve(__dirname, '..');

/** Loads the config in a fresh process with the given environment and reports how it went */
function loadConfig(vars: Record<string, string>) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', "require('./src/config/env')"], {
    cwd: serverDir,
    env: { PATH: process.env.PATH, ...vars },
    encoding: 'utf8',
  });
  return { exitCode: result.status, output: result.stderr + result.stdout };
}

const good = {
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb+srv://app:pw@cluster0.example.mongodb.net/connecto',
  JWT_SECRET: 'a3f9c1e07b5d4a2f8e6c0b9d7a1e3f5c2b4d6e8f0a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1',
  PUBLIC_BASE_URL: 'https://api.example.in',
};

test('production config: unsafe values are refused', () => {
  const { exitCode, output } = loadConfig({
    ...good,
    MONGO_URI: 'mongodb://127.0.0.1:27017/connecto',
    JWT_SECRET: 'change-me-change-me-change-me-change-me',
    PUBLIC_BASE_URL: 'http://localhost:4050',
  });
  check('server refuses to start', exitCode === 1, output);
  check('names the local database', /MONGO_URI/.test(output), output);
  check('names the weak JWT secret', /JWT_SECRET/.test(output), output);
  check('names the non-https public URL', /PUBLIC_BASE_URL/.test(output), output);
});

test('production config: a safe setup loads', () => {
  const { exitCode, output } = loadConfig(good);
  check('config loads', exitCode === 0, output);
});
