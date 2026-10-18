// Preserve Expo's resolver/transform defaults; only add the fixed ESM decoder.
const preset = require('jest-expo/jest-preset');
const patterns = preset.transformIgnorePatterns;
if (!patterns.some(p => p.includes('/node_modules/(?!('))) {
  throw new Error('Review the Expo Jest transform configuration after upgrading');
}
module.exports = {
  "preset": "jest-expo",
  "setupFiles": [
    "<rootDir>/jest.setup.ts"
  ],
  "testPathIgnorePatterns": [
    "/node_modules/",
    "/android/",
    "/ios/"
  ],
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  transformIgnorePatterns: patterns.map(p => p.replace('/node_modules/(?!(', '/node_modules/(?!(decode-uri-component|')),
};
