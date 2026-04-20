import type { Config } from "jest";

const config: Config = {
  rootDir: "..",
  testEnvironment: "node",
  testRegex: "test/integration/.*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
};

export default config;
