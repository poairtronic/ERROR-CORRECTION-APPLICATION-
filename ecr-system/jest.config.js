module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.module.(t|j)s',
    '!**/*.entity.(t|j)s',
    '!**/*.dto.(t|j)s',
    '!**/dto/**',
    '!**/enums/**',
    '!**/entities/**',
    '!**/*.types.(t|j)s',
    '!**/main.ts',
    '!**/main.hmr.ts',
    '!**/*.spec.ts',
    '!**/*.test.ts',
    '!**/migrations/**',
    '!**/report-sequence.entity.ts',
  ],
  coverageDirectory: '../coverage',
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 50,
      functions: 55,
      lines: 60,
    },
  },
  testEnvironment: 'node',
};
