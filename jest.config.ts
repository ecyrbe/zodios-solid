import type { Config } from "@jest/types";

// Objet synchrone
const config: Config.InitialOptions = {
  verbose: true,
  moduleFileExtensions: ["ts", "js", "tsx", "jsx", "json", "node"],
  rootDir: "./",
  testRegex: ".(spec|test).tsx?$",
  coverageDirectory: "./coverage",
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  //  testEnvironment: "node",
  preset: "solid-jest/preset/browser",
};
export default config;
