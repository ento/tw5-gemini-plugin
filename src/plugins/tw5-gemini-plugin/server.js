/*\
title: $:/plugins/ento/gemini/server.js
type: application/javascript
module-type: library

Serve tiddlers over the Gemini protocol

\*/

/* global $tw: false */

const url = $tw.node ? require('url') : null;
const querystring = $tw.node ? require('querystring') : null;
const gemini = $tw.node ? require('@derhuerst/gemini') : null;

const logger = new $tw.utils.Logger('gemini-server');

/**
  A simple Gemini server with regexp-based routes.
  Taken nearly as-is from TiddlyWiki's own server module.

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
  // Clients I've tried don't seem to support ALPN; turn it off
  this.upstreamOptions = { verifyAlpnId: () => true, ...tls };
  this.routes = options.routes || [];
  this.config = $tw.utils.extend({}, this.defaultConfig, options.config);
  const self = this;
  $tw.modules.forEachModuleOfType('gemini-route', (title, routeDefinition) => {
    if (self.get('debug-level') !== 'none') {
      logger.log('Loading server route', title);
    }
    self.addRoute(routeDefinition);
  });
}

Server.prototype.defaultConfig = {
  port: gemini.DEFAULT_PORT,
  host: '127.0.0.1',
  'root-tiddler': 'HelloGemini',
  'debug-level': 'none',
  'path-prefix': null,
};

Server.prototype.get = function get(name) {
  return this.config[name];
};

Server.prototype.addRoute = function addRoute(route) {
  this.routes.push(route);
};

Server.prototype.findMatchingRoute = function findMatchingRoute(request, state) {
  for (let t = 0; t < this.routes.length; t += 1) {
    const potentialRoute = this.routes[t];
    let { pathname } = state.urlInfo;
    let match;
    if (state.pathPrefix) {
      if (pathname.substr(0, state.pathPrefix.length) === state.pathPrefix) {
        pathname = pathname.substr(state.pathPrefix.length) || '/';
        match = potentialRoute.path.exec(pathname);
      } else {
        match = false;
      }
    } else {
      match = potentialRoute.path.exec(pathname);
    }
    if (match) {
      const params = [];
      for (let p = 1; p < match.length; p += 1) {
        params.push(match[p]);
      }
      return [potentialRoute, params];
    }
  }
  return [];
};

Server.prototype.requestHandler = function requestHandler(request, response, maybeOptions) {
  const options = maybeOptions || {};
  // Compose the state object
  const state = {};
  state.wiki = options.wiki || this.wiki;
  state.server = this;
  state.urlInfo = url.parse(request.url);
  state.queryParameters = querystring.parse(state.urlInfo.query);
  state.pathPrefix = options.pathPrefix || this.get('path-prefix') || '';
  // Find the route that matches this path
  const [route, params] = this.findMatchingRoute(request, state);
  // Optionally output debug info
  if (this.get('debug-level') !== 'none') {
    logger.log('Request path:', JSON.stringify(state.urlInfo));
    logger.log('Route:', JSON.stringify(route));
  }
  // Return a 404 if we didn't find a route
  if (!route) {
    response.notFound();
    return;
  }
  route.handler(request, response, params, state);
};

/**
  Listen for requests

  @param {String} maybePort Optional port number (falls back to value of "port" variable)
  @param {String} maybeHost Optional host address (falls back to value of "host" variable)
  @param {String} maybePrefix Optional prefix (falls back to value of "path-prefix" variable)
*/
Server.prototype.listen = function listen(maybePort, maybeHost, maybePrefix) {
  // Handle defaults for port and host
  let port = maybePort || this.get('port');
  const host = maybeHost || this.get('host');
  const prefix = maybePrefix || this.get('path-prefix') || '';
  // Check for the port being a string and look it up as an environment variable
  if (parseInt(port, 10).toString() !== port) {
    port = process.env[port] || this.defaultConfig.port;
  }
  // Create the server
  const server = gemini.createServer(this.upstreamOptions, this.requestHandler.bind(this));
  // Display the port number after we've started listening
  // (the port number might have been specified as zero, in which case we will get an assigned port)
  server.on('listening', () => {
    const address = server.address();
    logger.log(`Serving on gemini://${address.address}:${address.port}${prefix}`);
    logger.log('(press ctrl-C to exit)');
  });
  // Listen
  server.listen(port, host);
};

exports.Server = Server;
