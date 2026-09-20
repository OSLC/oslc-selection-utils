/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@oslc/postmessage-helper$': '<rootDir>/../oslc-postmessage-helper/dist/index.js',
  },
};
