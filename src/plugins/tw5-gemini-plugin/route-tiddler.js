/*\
title: $:/plugins/ento/gemini/route-tiddler.js
type: application/javascript
module-type: gemini-route

Path: /t/TiddlerTitle

\*/

const RenderStrategy = Object.freeze({
  Passthru: Symbol('Passthru'),
  Render: Symbol('Render'),
});

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

const renderTiddler = (wiki, tiddler, response) => {
  /*
    Render the found tiddler. How we go about it depends on the tiddler's
    type, gemini-render-type, and gemini-mime-type fields.

    In tagged union form, the possible strategies look like:

    type RenderStrategy
      {-| Passthrough the text field as the specified mime-type -}
      = Passthru MimeType
      {-| Let TiddlyWiki render the tiddler and then optionally convert -}
      | Render RenderType

    type RenderType
      = HtmlToGemini -- Idea: HTML to Gemini converter
      | HtmlContent MimeType
      | TextContent MimeType

    How to determine the rendering strategy:

    -- Idea: The default renderType could be set per content type, e.g.
    -- $:/plugins/ento/gemini/config/alwaysRenderAsHtml
    case (type, renderType, mimeType) of
      (text/gemini, _, _) ->
        Passthru (mimeType || type)
      (_, Nothing, _) ->
        Passthru (mimeType || type)
      -- HtmlToGemini not implemented yet
      -- (_, Just text/html, Just text/gemini) ->
      --   Render HtmlToGemini
      (_, Just text/html, _) ->
        Render (HtmlContent (mimeType || type))
      (_, Just text/plain, _) ->
        Render (TextContent (mimeType || type))
  */
  const {
    type,
    'gemini-mime-type': givenMimeType,
    'gemini-render-type': givenRenderType,
  } = tiddler.fields;
  let renderStrategy;
  if (type === 'text/gemini') {
    renderStrategy = RenderStrategy.Passthru;
  } else if (!givenRenderType) {
    renderStrategy = RenderStrategy.Passthru;
  } else {
    renderStrategy = RenderStrategy.Render;
  }
  // Figure out the main body
  let { text } = tiddler.fields;
  // If passing through the tiddler as-is, prepend the tiddler title
  // if we know the formatting syntax.
  // This may appear as inconsistent across types, but the convenience
  // seems like a win for now.
  let titleHeading = '';
  if (renderStrategy === RenderStrategy.Passthru) {
    if (type === 'text/gemini' || type === 'text/x-markdown') {
      titleHeading = `# ${tiddler.fields.title}\n`;
    } else if (type === 'text/vnd.tiddlywiki') {
      titleHeading = `! ${tiddler.fields.title}\n`;
    }
  }
  text = titleHeading + text;
  if (renderStrategy === RenderStrategy.Render) {
    text = wiki.renderText(
      givenRenderType, type, text, { variables: { currentTiddler: tiddler.fields.title } },
    );
  }
  // Figure out the mime-type
  let mimeType = givenMimeType || type;
  if (tiddler.fields.lang) {
    mimeType += `; lang=${tiddler.fields.lang}`;
  }
  response.mimeType = mimeType;
  response.write(text, null, () => {
    response.end();
  });
};
exports.renderTiddler = renderTiddler;

exports.handler = function handler(request, response, params, state) {
  const tiddler = getTiddler(state.wiki, params);
  if (!tiddler) {
    response.notFound();
    return;
  }
  renderTiddler(state.wiki, tiddler, response);
};
