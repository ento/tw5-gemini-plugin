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
    const title = decodeURIComponent(state.urlInfo.hash.slice(1));
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
  } else {
    let { text } = tiddler.fields;
    let mimeType = 'text/gemini';
    if (tiddler.fields.type !== 'text/gemini') {
      mimeType = 'text/plain';
      text = state.wiki.renderTiddler('text/plain', tiddler.fields.title);
    }
    if (tiddler.fields.lang) {
      mimeType += `; lang=${tiddler.fields.lang}`;
    }
    response.mimeType = mimeType;
    response.end(`# ${tiddler.fields.title}\n${text}`);
  }
};
