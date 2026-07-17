module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
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
