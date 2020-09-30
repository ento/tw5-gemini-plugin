/*\
title: $:/plugins/ento/gemini/route-index.js
type: application/javascript
module-type: gemini-route

Path: /

\*/

const { renderTiddler } = require('$:/plugins/ento/gemini/route-tiddler.js');

exports.path = /^\/$/;

exports.handler = function handler(request, response, _params, state) {
  const tiddler = state.wiki.getTiddler(state.server.get('root-tiddler'));
  if (!tiddler) {
    response.notFound();
    return;
  }
  renderTiddler(state.wiki, tiddler, response);
};
