/*\
title: test_atomfeed.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Test gemini-atomfeed macro
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
  const parser = wiki.parseText('text/vnd.tiddlywiki', text, options);
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

function feed(metadata = { author: '' }, content = '') {
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title></title><subtitle></subtitle><link href="https://example.com/atom.xml" rel="self"></link><link href="https://example.com"></link><author><name>${metadata.author}</name></author><id></id><updated></updated>${content}</feed>`;
}

describe('tw5-gemini-plugin gemini-atomfeed macro', () => {
  it('renders with no entries', () => {
    const wiki = new $tw.Wiki();
    const text = '<$text text=<<gemini-atomfeed filter:"">>/>';
    const wrapper = renderText(wiki, text);
    expect(wrapper.textContent).toBe(feed());
  });

  xit('gives error when filter is invalid', () => {
    const wiki = new $tw.Wiki();
    const text = '<$text text=<<gemini-atomfeed filter:"[[]">>/>';
    const wrapper = renderText(wiki, text);
    expect(wrapper.textContent).toBe(feed());
  });

  it('renders with one entry', () => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: 'Hello', text: '', type: 'text/gemini' });
    wiki.addTiddler({ title: '$:/config/atomserver', text: 'https://example.com', type: 'text/plain' });
    const text = '<$text text=<<gemini-atomfeed filter:"">>/>';
    const wrapper = renderText(wiki, text);
    expect(wrapper.textContent).toBe(feed({ author: undefined }, '<entry><title>Hello</title><link href="https://example.com/#Hello"></link><id>8b1a9953-c461-1296-a827-abf8c47804d7</id><updated></updated><content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"></div></content><author><name>undefined</name></author><link href="https://example.com/#Hello" rel="alternate" type="text/gemini"></link></entry>'));
  });

  it('does not render entry filtered out by config', () => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: 'Hello', text: '', type: 'text/gemini' });
    wiki.addTiddler({ title: '$:/config/atomserver', text: 'https://example.com', type: 'text/plain' });
    wiki.addTiddler({
      title: '$:/plugins/ento/gemini/config/filter',
      text: '[tag[no-match]]',
      type: 'text/plain',
    });
    const text = '<$text text=<<gemini-atomfeed filter:"">>/>';
    const wrapper = renderText(wiki, text);
    expect(wrapper.textContent).toBe(feed());
  });
});
