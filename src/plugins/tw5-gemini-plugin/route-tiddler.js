/*\
title: $:/plugins/ento/gemini/route-tiddler.js
type: application/javascript
module-type: gemini-route

Path: /t/TiddlerTitle

\*/
/* global $tw: false */

const { render: renderAsGemini } = require('$:/plugins/ento/gemini/renderer.js');

exports.path = /^\/t\/(.+)$/;

const getTiddler = (wiki, params) => {
  const title = decodeURIComponent(params[0]);
  const filter = wiki.getTiddlerText('$:/plugins/ento/gemini/config/filter');
  if (filter) {
    const source = wiki.makeTiddlerIterator([title]);
    const result = wiki.filterTiddlers(filter, null, source);
    if (result.length > 0) {
      return wiki.getTiddler(result[0]);
    }
  } else {
    return wiki.getTiddler(title);
  }
  return null;
};

const defaultRenderers = {};

function makeNativeWidgetRenderer(mimeType, stringifier) {
  const renderer = function nativeWidgetRenderer(wiki, tiddler, res) {
    const options = { variables: { currentTiddler: tiddler.fields.title } };
    const parser = wiki.parseText(tiddler.fields.type, tiddler.fields.text, options);
    const widgetNode = wiki.makeWidget(parser, options);
    const container = $tw.fakeDocument.createElement('div');
    widgetNode.render(container, null);
    stringifier(container, res);
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
  (container, res) => renderAsGemini(container, res),
);

function passthroughRenderer(wiki, tiddler, res) {
  res.write(tiddler.fields.text);
}
defaultRenderers['text/x-passthrough'] = passthroughRenderer;

function renderTiddler(wiki, tiddler, response) {
  /*
    Render the found tiddler. How we go about it depends on the tiddler's
    type, gemini-render-type, and gemini-mime-type fields.

    Which renderer to use is determined in the following order:
    a. If gemini-render-type is specified, use it
    b. If not, use the tiddler's type
    c. If no renderer of that type is found, default to text/gemini

    Available renderers are:
    - text/gemini
    - text/html
    - text/plain
    - text/x-passthrough

    Of these, all but text/x-passthrough uses the same broad strategy:

    1. The tiddler text is parsed according to its type.
    2. The parsed tree is rendered to DOM.
    3. The DOM is converted to string.

    The text/x-passthrough renderer returns the tiddler text as-is.

    The mime-type of the response is determined as follows:
    1. If gemini-mime-type is specified, use it
    2. If not, use the renderer's mimeType property.
    3. If the renderer doesn't have such a property, use the tiddler type.
  */
  const {
    type,
    'gemini-mime-type': givenMimeType,
    'gemini-render-type': givenRenderType,
  } = tiddler.fields;
  const renderType = givenRenderType || type;
  const renderer = defaultRenderers[renderType] || defaultRenderers['text/plain'];

  response.mimeType = givenMimeType || renderer.mimeType || type;
  if (tiddler.fields.lang) {
    response.mimeType += `; lang=${tiddler.fields.lang}`;
  }

  renderer(wiki, tiddler, response);
  response.end();
}
exports.renderTiddler = renderTiddler;

exports.handler = function handler(request, response, params, state) {
  const tiddler = getTiddler(state.wiki, params);
  if (!tiddler) {
    response.notFound();
    return;
  }
  renderTiddler(state.wiki, tiddler, response);
};
