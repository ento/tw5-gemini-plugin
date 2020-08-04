/*\
title: $:/plugins/ento/gemini/listen.js
type: application/javascript
module-type: command

Listen for Gemini requests and serve tiddlers

\*/
"use strict";

const Server = require("$:/plugins/ento/gemini/server.js").Server;

exports.info = {
  name: "gemini-listen",
  synchronous: true,
  namedParameterMode: true,
  mandatoryParameters: ["tls-key", "tls-cert"],
};

if ($tw.node) {
  var fs = require("fs"),
      path = require("path");
}

const Command = function(params, commander, callback) {
  this.params = params;
  this.commander = commander;
  this.callback = callback;
};

Command.prototype.execute = function() {
  const self = this;
  if(!$tw.boot.wikiTiddlersPath) {
    $tw.utils.warning("Warning: Wiki folder '" + $tw.boot.wikiPath + "' does not exist or is missing a tiddlywiki.info file");
  }
  const tls = {
    key: fs.readFileSync(path.resolve(self.params["tls-key"]), "utf8"),
    cert: fs.readFileSync(path.resolve(self.params["tls-cert"]), "utf8")
  };
  // Set up server
  this.server = new Server(
    this.commander.wiki,
    tls,
    { config: self.params },
  );
  this.server.listen();
  return null;
};

exports.Command = Command;
