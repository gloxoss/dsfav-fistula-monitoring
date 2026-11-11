// Runs unit (*.spec.ts) and e2e (*.e2e-spec.ts) tests. ESM mode needs --experimental-vm-modules (see package.json scripts).
// Regex patterns use String.raw so backslashes survive: a plain JS string would turn "\." into "." and
// moduleNameMapper would then strip ".js" from unrelated ids such as "../core/index.cjs".
export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: String.raw`\.(e2e-)?spec\.ts$`,
  transform: {
    [String.raw`^.+\.ts$`]: ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  // tsconfig and sources use ".js" specifiers (NodeNext). Map them back to .ts for Jest.
  moduleNameMapper: { [String.raw`^(\.{1,2}/.*)\.js$`]: '$1' },
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: '../../coverage/api',
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: '../../reports/junit', outputName: 'api.xml' }],
  ],
};
