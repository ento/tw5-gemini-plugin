/*\
title: $:/plugins/ento/gemini/startup.js
type: application/javascript
module-type: startup

Register file type for Gemini.

\*/
/* global $tw: false */

// Export name and synchronous status
exports.name = 'gemini';
exports.after = ['startup'];
exports.synchronous = true;

exports.startup = function startup() {
  $tw.utils.registerFileType('text/gemini', 'utf8', ['.gmi']);
};
