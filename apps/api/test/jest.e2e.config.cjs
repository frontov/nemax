/** @type {import("jest").Config} */
module.exports = {
  rootDir: "..",
  testEnvironment: "node",
  testRegex: "test/e2e/.*\\.e2e-spec\\.ts$",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
  testTimeout: 30000,
};
