// Offline React regression bundle only; uses the project's existing TypeScript.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Webpack's synchronous CommonJS loader entry point.
const ts = require("typescript");
module.exports = function verificationTypeScript(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
};
