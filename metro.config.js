const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const reactI18nextRoot = path.dirname(
  require.resolve("react-i18next/package.json"),
);

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-i18next") {
    return {
      filePath: path.join(reactI18nextRoot, "dist/commonjs/index.js"),
      type: "sourceFile",
    };
  }

  if (moduleName.startsWith("react-i18next/")) {
    const subpath = moduleName.slice("react-i18next/".length);
    return {
      filePath: path.join(reactI18nextRoot, "dist/commonjs", `${subpath}.js`),
      type: "sourceFile",
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativewind(config);
