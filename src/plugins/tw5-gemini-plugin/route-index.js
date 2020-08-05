/*\
title: $:/plugins/ento/gemini/route-index.js
type: application/javascript
module-type: gemini-route

Path: /#TiddlerTitle

\*/

exports.path = /^\/$/;

exports.handler = function handler(request, response, _params, state) {
  let tiddler;
  if (state.urlInfo.hash !== null) {
    const title = state.urlInfo.hash.slice(1);
    const filter = state.wiki.getTiddlerText('$:/plugins/ento/gemini/config/filter');
    if (filter) {
      const source = state.wiki.makeTiddlerIterator([title]);
      const result = state.wiki.filterTiddlers(filter, null, source);
      if (result.length > 0) {
        tiddler = state.wiki.getTiddler(result[0]);
      }
    } else {
      tiddler = state.wiki.getTiddler(title);
    }
  } else {
    tiddler = state.wiki.getTiddler(state.server.get('root-tiddler'));
  }
  if (!tiddler) {
    response.notFound();
  } else if (tiddler.fields.type === 'text/gemini') {
    response.mimeType = 'text/gemini';
    response.end(tiddler.fields.text);
  } else {
    const text = state.wiki.renderTiddler('text/plain', tiddler.fields.title);
    response.mimeType = 'text/plain';
    response.end(text);
  }
};
