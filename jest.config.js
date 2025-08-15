// jest.config.js
module.exports = {
  testEnvironment: 'node',
  verbose: true,
  roots: ['.'],
  testMatch: ['**/*.test.js'],
  moduleNameMapper: {
    '^wix-data$': '<rootDir>/__mocks__/wix-data.js',
    '^wix-members-frontend$': '<rootDir>/__mocks__/wix-members-frontend.js',
    '^wix-location$': '<rootDir>/__mocks__/wix-location.js',
  },
};
