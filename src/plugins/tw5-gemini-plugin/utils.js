/*\
title: $:/plugins/ento/gemini/utils.js
type: application/javascript
module-type: library

Utility functions.

\*/

exports.optionalRequire = function optionalRequire(moduleName) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(moduleName);
  } catch (e) {
    return {};
  }
};
