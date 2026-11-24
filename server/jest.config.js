/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  setupFiles: ['<rootDir>/jest/setup-env.js'],
  globalSetup: '<rootDir>/jest/globalSetup.js',
  globalTeardown: '<rootDir>/jest/globalTeardown.js',
  maxWorkers: 1,
  testTimeout: 120000,
};
