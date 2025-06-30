/*\
title: test_parser.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Test Gemini parser for TiddlyWiki
\*/

/* global $tw: false */

const fc = $tw.node ? require('fast-check') : null;

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

    expect(wrapper.innerHTML).toBe('<div>hello gemini</div>');
  });

  it('renders blank text line', () => {
    const wiki = new $tw.Wiki();
    const text = 'hello\n\ngemini\n';
    const wrapper = renderText(wiki, text);

    expect(wrapper.innerHTML).toBe('<div>hello</div><br><div>gemini</div>');
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

    expect(wrapper.innerHTML).toBe('<div>before</div><pre><code># hello</code></pre><div>after</div>');
  });

  it('renders heading lines', () => {
    const wiki = new $tw.Wiki();
    const text = `#h1
## h2
###h3`;
    const wrapper = renderText(wiki, text);

    expect(wrapper.innerHTML).toBe('<h1>h1</h1><h2>h2</h2><h3>h3</h3>');
  });

  it('renders unordered list item lines', () => {
    const wiki = new $tw.Wiki();
    const text = `* a
*  b`;
    const wrapper = renderText(wiki, text);

    expect(wrapper.innerHTML).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('renders unordered list item lines surrounded by text lines', () => {
    const wiki = new $tw.Wiki();
    const text = `list
* a
* b
*after list`;
    const wrapper = renderText(wiki, text);

    expect(wrapper.innerHTML).toBe('<div>list</div><ul><li>a</li><li>b</li></ul><div>*after list</div>');
  });

  it('renders quoted lines', () => {
    const wiki = new $tw.Wiki();
    const text = `>a
> b`;
    const wrapper = renderText(wiki, text);

    expect(wrapper.innerHTML).toBe('<blockquote><div>a</div><div>b</div></blockquote>');
  });

  it('renders quoted lines surrounded by text lines', () => {
    const wiki = new $tw.Wiki();
    const text = `quote
>a
> b
by foo`;
    const wrapper = renderText(wiki, text);

    expect(wrapper.innerHTML).toBe('<div>quote</div><blockquote><div>a</div><div>b</div></blockquote><div>by foo</div>');
  });

  if (fc) {
    it('renders arbitrary text', () => {
      const wiki = new $tw.Wiki();
      const linePrefixes = ['', '#', '##', '###', '=>', '>', '*', '```'];
      const empty = fc.constant('');
      // Generator for simple lines consisting of prefixes and arbitrary string
      const simpleLine = fc.tuple(
        fc.constantFrom(...linePrefixes),
        fc.constantFrom('', ' '),
        fc.string(),
      ).map((t) => t.join(''));
      // Generators for lines that have some kind of expected structure
      const linkLine = fc.tuple(
        fc.constant('=>'),
        fc.constantFrom('', ' ', ' #'),
        fc.oneof(fc.webUrl(), fc.emailAddress(), fc.string()),
        fc.constantFrom('', ' '),
        fc.oneof(empty, fc.string()),
      ).map((t) => t.join(''));
      const preformattedBlock = fc.tuple(
        fc.constant('```'),
        fc.oneof(empty, fc.string()),
        fc.constant('\n'),
        fc.oneof(empty, simpleLine, fc.string()),
        fc.constant('\n'),
        fc.constant('```'),
        fc.oneof(empty, fc.string()),
      ).map((t) => t.join(''));

      fc.assert(
        fc.property(fc.array(fc.oneof(simpleLine, linkLine, preformattedBlock)), (data) => {
          const text = data.join('\n');

          expect(() => renderText(wiki, text)).withContext(text).not.toThrowError();
        }),
      );
    });
  }
});
