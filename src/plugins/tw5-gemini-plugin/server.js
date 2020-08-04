/*\
title: $:/plugins/ento/gemini/server.js
type: application/javascript
module-type: library

Serve tiddlers over the Gemini protocol

\*/

/*global $tw: false */
"use strict";

if ($tw.node) {
  var url = require("url"),
      querystring = require("querystring"),
      gemini = require("@derhuerst/gemini");
}

const logger = new $tw.utils.Logger("gemini-server");

/**
  A simple Gemini server with regexp-based routes

  @param {Wiki} wiki Reference to wiki object
  @param {Object} tls TLS certificate and key
  @param {Object} tls.key TLS key
  @param {Object} tls.cert TLS certificate
  @param {Object} options Optional configs
  @param {Object} options.config Optional config values to set
  @param {Object} options.routes Optional array of routes to use
*/
function Server(wiki, tls, options) {
  this.wiki = wiki;
  this.tls = tls;
  this.routes = options.routes || [];
  this.config = $tw.utils.extend({}, this.defaultConfig, options.config);
  const self = this;
  $tw.modules.forEachModuleOfType("gemini-route", function(title, routeDefinition) {
    if (self.get("debug-level") !== "none") {
      logger.log("Loading server route", title);
    }
    self.addRoute(routeDefinition);
  });
}

Server.prototype.defaultConfig = {
  port: "1965",
  host: "127.0.0.1",
  "root-tiddler": "HelloGemini",
  "debug-level": "none",
};

Server.prototype.get = function(name) {
  return this.config[name];
};

Server.prototype.addRoute = function(route) {
  this.routes.push(route);
};

Server.prototype.findMatchingRoute = function(request, state) {
  for (let t = 0; t < this.routes.length; t++) {
    const potentialRoute = this.routes[t],
          pathRegExp = potentialRoute.path;
    let pathname = state.urlInfo.pathname,
        match;
    if (state.pathPrefix) {
      if (pathname.substr(0, state.pathPrefix.length) === state.pathPrefix) {
        pathname = pathname.substr(state.pathPrefix.length) || "/";
        match = potentialRoute.path.exec(pathname);
      } else {
        match = false;
      }
    } else {
      match = potentialRoute.path.exec(pathname);
    }
    if (match) {
      state.params = [];
      for (let p = 1; p < match.length; p++) {
        state.params.push(match[p]);
      }
      return potentialRoute;
    }
  }
  return null;
};

Server.prototype.requestHandler = function(request, response, options) {
  options = options || {};
  // Compose the state object
  const state = {};
  state.wiki = options.wiki || this.wiki;
  state.server = this;
  state.urlInfo = url.parse(request.url);
  state.queryParameters = querystring.parse(state.urlInfo.query);
  state.pathPrefix = options.pathPrefix || this.get("path-prefix") || "";
  // Find the route that matches this path
  const route = this.findMatchingRoute(request, state);
  // Optionally output debug info
  if (this.get("debug-level") !== "none") {
    console.log("Request path:", JSON.stringify(state.urlInfo));
    console.log("Route:", JSON.stringify(route));
  }
  // Return a 404 if we didn't find a route
  if (!route) {
    response.notFound();
    return;
  }
  route.handler(request, response, state);
};

/**
  Listen for requests

  @param {String} port Optional port number (falls back to value of "port" variable)
  @param {String} host Optional host address (falls back to value of "host" variable)
  @param {String} prefix Optional prefix (falls back to value of "path-prefix" variable)
*/
Server.prototype.listen = function(port, host, prefix) {
  // Handle defaults for port and host
  port = port || this.get("port");
  host = host || this.get("host");
  prefix = prefix || this.get("path-prefix") || "";
  // Check for the port being a string and look it up as an environment variable
  if (parseInt(port, 10).toString() !== port) {
    port = process.env[port] || this.defaultConfig.port;
  }
  // Create the server
  const server = gemini.createServer(this.tls, this.requestHandler.bind(this));
  // Display the port number after we've started listening (the port number might have been specified as zero, in which case we will get an assigned port)
  server.on("listening", function() {
    const address = server.address();
    logger.log("Serving on gemini://" + address.address + ":" + address.port + prefix);
    logger.log("(press ctrl-C to exit)");
  });
  // Listen
  server.listen(port, host);
};

exports.Server = Server;
