/*\
title: $:/plugins/ento/gemini/route-tiddler.js
type: application/javascript
module-type: gemini-route

Path: /t/TiddlerTitle

\*/
/* global $tw: false */

const { domToGemtext, tiddlerToDom } = require('$:/plugins/ento/gemini/renderer.js');

exports.path = /^\/t\/(.+)$/;

const getTiddler = (wiki, params) => {
  const title = decodeURIComponent(params[0]);
  const filter = wiki.getTiddlerText('$:/plugins/ento/gemini/config/filter');
  if (filter) {
    const source = wiki.makeTiddlerIterator([title]);
    const result = wiki.filterTiddlers(filter, null, source);
    if (result.indexOf(title) > -1) {
      return wiki.getTiddler(title);
    }
  } else {
    return wiki.getTiddler(title);
  }
  return null;
};

const defaultRenderers = {};

function makeNativeWidgetRenderer(mimeType, stringifier) {
  const renderer = function nativeWidgetRenderer(wiki, tiddler, res, enableTrace) {
    const container = tiddlerToDom(wiki, tiddler, $tw.fakeDocument);
    stringifier(container, res, enableTrace);
  };
  renderer.mimeType = mimeType;
  return renderer;
}
defaultRenderers['text/html'] = makeNativeWidgetRenderer(
  'text/html',
  (container, res) => res.write(container.innerHTML),
);
defaultRenderers['text/plain'] = makeNativeWidgetRenderer(
  'text/plain',
  (container, res) => res.write(container.textContent),
);
defaultRenderers['text/gemini'] = makeNativeWidgetRenderer(
  'text/gemini',
  (container, res, enableTrace) => domToGemtext(container, res, enableTrace),
);

function passthroughRenderer(wiki, tiddler, res) {
  res.write(tiddler.fields.text);
}
defaultRenderers['text/x-passthrough'] = passthroughRenderer;

function renderTiddler(wiki, tiddler, response, enableTrace) {
  /*
    Render the found tiddler. How we go about it depends on the tiddler's
    type, gemini-renderer, and gemini-mime-type fields.

    Which renderer to use is determined in the following order:
    a. If gemini-renderer is specified, use it
    b. If not, use the tiddler's type
    c. If no renderer of that type is found, default to text/gemini

    Available renderers are:
    - text/gemini
    - text/html
    - text/plain
    - text/x-passthrough

    Of these, all but text/x-passthrough use the same broad strategy:

    1. The tiddler text is parsed according to its type.
    2. The parsed tree is rendered to DOM.
    3. The DOM is converted to string by the renderer.

    The text/x-passthrough renderer returns the tiddler text as-is.

    The mime-type of the response is determined in the following order:
    1. gemini-mime-type field of the tiddler.
    2. renderer's mimeType propert.
    3. type field of the tiddler.
  */
  const {
    type,
    'gemini-mime-type': mimeTypeField,
    'gemini-renderer': renderTypeField,
  } = tiddler.fields;
  const renderType = renderTypeField || type;
  const renderer = defaultRenderers[renderType] || defaultRenderers['text/gemini'];

  response.mimeType = mimeTypeField || renderer.mimeType || type;
  if (tiddler.fields.lang) {
    response.mimeType += `; lang=${tiddler.fields.lang}`;
  }

  renderer(wiki, tiddler, response, enableTrace);
  response.end();
}
exports.renderTiddler = renderTiddler;

exports.handler = function handler(request, response, params, state) {
  const tiddler = getTiddler(state.wiki, params);
  if (!tiddler) {
    response.notFound();
    return;
  }
  renderTiddler(state.wiki, tiddler, response, state.enableTrace);
};
