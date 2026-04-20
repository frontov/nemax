import type { Config } from "jest";

const config: Config = {
  rootDir: "..",
  testEnvironment: "node",
  testRegex: "test/e2e/.*\\.e2e-spec\\.ts$",
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

export default config;
