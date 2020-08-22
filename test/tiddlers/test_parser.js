/*\
title: test_parser.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Test Gemini parser for TiddlyWiki
\*/

/* global $tw: false */

/* helper functions taken from TiddlyWiki5/editions/test/tiddlers/tests/test-widget.js */
const widget = require('$:/core/modules/widgets/widget.js');

function createWidgetNode(parseTreeNode, wiki) {
  // eslint-disable-next-line new-cap
  return new widget.widget(parseTreeNode, {
    wiki,
    document: $tw.fakeDocument,
  });
}

function parseText(text, wiki, options) {
  const parser = wiki.parseText('text/gemini', text, options);
  return parser ? { type: 'widget', children: parser.tree } : undefined;
}

function renderWidgetNode(widgetNode) {
  $tw.fakeDocument.setSequenceNumber(0);
  const wrapper = $tw.fakeDocument.createElement('div');
  widgetNode.render(wrapper, null);
  return wrapper;
}

function renderText(wiki, text) {
  const widgetNode = createWidgetNode(parseText(text, wiki, { parseAsInline: true }), wiki);
  return renderWidgetNode(widgetNode);
}

describe('tw5-gemini-plugin parser', () => {
  it('renders text line', () => {
    const wiki = new $tw.Wiki();
    const text = 'hello gemini';
    const wrapper = renderText(wiki, text);
    expect(wrapper.innerHTML).toBe('<p>hello gemini</p>');
  });

  it('renders blank text line', () => {
    const wiki = new $tw.Wiki();
    const text = 'hello\n\ngemini\n';
    const wrapper = renderText(wiki, text);
    expect(wrapper.innerHTML).toBe('<p>hello</p><br><p>gemini</p><br>');
  });

  it('renders external link line without spaces', () => {
    const wiki = new $tw.Wiki();
    const text = '=>http://example.com';
    const wrapper = renderText(wiki, text);
    expect(wrapper.innerHTML).toBe('<div><a href="http://example.com" rel="noopen noreferrer" target="_blank">http://example.com</a></div>');
  });

  it('renders external link line with title', () => {
    const wiki = new $tw.Wiki();
    const text = '=>  http://example.com  Example Website';
    const wrapper = renderText(wiki, text);
    expect(wrapper.innerHTML).toBe('<div><a href="http://example.com" rel="noopen noreferrer" target="_blank">Example Website</a></div>');
  });

  it('renders external link line with encoded characters', () => {
    const wiki = new $tw.Wiki();
    const text = '=>http://example.com/?q=a%20b';
    const wrapper = renderText(wiki, text);
    expect(wrapper.innerHTML).toBe('<div><a href="http://example.com/?q=a%20b" rel="noopen noreferrer" target="_blank">http://example.com/?q=a%20b</a></div>');
  });

  it('renders internal link line', () => {
    const wiki = new $tw.Wiki();
    const text = '=> #Hello%20Gemini';
    const wrapper = renderText(wiki, text);
    expect(wrapper.outerHTML).toBe('<div><div><a class="tc-tiddlylink tc-tiddlylink-missing" href="#Hello%20Gemini">Hello Gemini</a></div></div>');
  });

  it('renders incomplete link lines', () => {
    const wiki = new $tw.Wiki();
    const text = '=>\n=> ';
    const wrapper = renderText(wiki, text);
    expect(wrapper.outerHTML).toBe('<div><br><br></div>');
  });

  it('renders preformatted text lines', () => {
    const wiki = new $tw.Wiki();
    const text = `\`\`\`gemini
# hello
\`\`\``;
    const wrapper = renderText(wiki, text);
    expect(wrapper.innerHTML).toBe('<pre><code># hello</code></pre>');
  });

  it('renders preformatted text lines with preceding and succeeding lines', () => {
    const wiki = new $tw.Wiki();
    const text = `before
\`\`\`gemini
# hello
\`\`\`
after`;
    const wrapper = renderText(wiki, text);
    expect(wrapper.innerHTML).toBe('<p>before</p><pre><code># hello</code></pre><p>after</p>');
  });

  it('renders heading lines', () => {
    const wiki = new $tw.Wiki();
    const text = `#h1
## h2
###h3`;
    const wrapper = renderText(wiki, text);
    expect(wrapper.innerHTML).toBe('<h1>h1</h1><h2>h2</h2><h3>h3</h3>');
  });

  it('renders quoted lines', () => {
    const wiki = new $tw.Wiki();
    const text = `quote
>a
> b
by foo`;
    const wrapper = renderText(wiki, text);
    expect(wrapper.innerHTML).toBe('<p>quote</p><blockquote><div>a</div><div> b</div></blockquote><p>by foo</p>');
  });
});
