import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const temp = mkdtempSync(join(tmpdir(), 'dsfav-native-'));
const executable = join(temp, 'native-tests.exe');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim();
}

try {
  run('zig', ['c++', '-std=c++17', '-Ilib/dsfav_protocol', 'test/native_main.cpp', '-o', executable]);
  const cppOutput = run(executable, []);
  const lines = cppOutput.split(/\r?\n/);
  const cppFrame = lines[0];

const simulatorFrame = run('uv', [
  'run', '--project', '../../scripts/simulator', 'python', '-c',
  'import numpy as np; from dsfav_sim.protocol import encode_raw; a=np.array([[1,-2,16384],[-16384,32767,-32768]],dtype=float)/16384; l=np.array([[1024,-1024,0],[-1,2,-3]],dtype=float)/1024; p=np.array([540,250,300,850,900,-1,1234,0,1,32767],dtype=float)/100; print(encode_raw(a,l,p,fs_adxl=2,fs_lis=2).hex())',
]);
if (cppFrame !== simulatorFrame) {
  console.error(`simulator frame mismatch: C++ ${cppFrame}, simulator ${simulatorFrame}`);
  process.exit(1);
}
console.log('[G1] framing matches simulator encoder (header and payload)');

const sourceFiles = ['src', 'lib'].flatMap((directory) => {
  const result = spawnSync('rg', ['-n', '-i', String.raw`(?:ssid|password|token)\s*(?:=|:)\s*["'][^"']+["']`, directory], { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status === 0) return result.stdout.trim().split(/\r?\n/);
  if (result.status === 1) return [];
  throw new Error(result.stderr);
});
if (sourceFiles.length) throw new Error(`credential literals found:\n${sourceFiles.join('\n')}`);
console.log('[G2] credentials are provisioned; no SSID, password, or token literals in src/lib');
console.log(lines.slice(1).join('\n'));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
