module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^uuid$': '<rootDir>/src/__mocks__/uuid.js',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/cli/**',
    '!src/**/migrations/**',
  ],
  coverageThreshold: {
    global: {
      branches: 19,
      functions: 26,
      lines: 26,
      statements: 27,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
};