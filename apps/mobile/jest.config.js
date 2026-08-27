/**
 * Deliberately not `jest-expo` — that pulls in RN component-rendering
 * mocks this sandbox has no simulator/device to meaningfully verify
 * against. Scoped to plain-Node-runnable, React-Native-import-free pure
 * logic (see apps/mobile/src/location/*.spec.ts): keep new specs to
 * `.spec.ts`, never `.spec.tsx`.
 */
module.exports = {
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.jest.json' }],
  },
};
