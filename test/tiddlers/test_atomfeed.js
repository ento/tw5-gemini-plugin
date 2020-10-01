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

function feed(metadata = { author: '' }, entries = []) {
  const content = entries.map((e) => `<entry><title>${e.title}</title><link href="${e.link}"></link><id>${e.id}</id><updated></updated><content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"></div></content><author><name>undefined</name></author><link href="${e.link}" rel="alternate" type="text/gemini"></link></entry>`);
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title></title><subtitle></subtitle><link href="https://example.com/atom.xml" rel="self"></link><link href="https://example.com"></link><author><name>${metadata.author}</name></author><id></id><updated></updated>${content.join('')}</feed>`;
}

describe('tw5-gemini-plugin gemini-atomfeed macro', () => {
  it('renders with no entries', () => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/config/atomserver', text: 'https://example.com', type: 'text/plain' });
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
    const entries = [
      { title: 'Hello', link: 'https://example.com/#Hello', id: '8b1a9953-c461-1296-a827-abf8c47804d7' },
    ];
    expect(wrapper.textContent).toBe(feed({ author: undefined }, entries));
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

  /* Possible combinations of config filter results and macro param filter results:
     Config    Macro param
     []        []      => []
     []        [some2] => []
     [some]    []      => []
     [some] <  [some2] => [some]
     [some] =  [some2] => [some] (== [some2])
     [some] >  [some2] => [some2]
     [some] != [some2] => []
     [some] ~  [some2] => [some & some2] (partial overlap)
  */

  function addFixtureTiddlers(wiki) {
    const tiddlers = [
      { title: 'Hello 1', text: '', tags: 'one a' },
      { title: 'Hello 2', text: '', tags: 'one a' },
      { title: 'Hello 3', text: '', tags: 'one three b' },
      { title: 'Hello 4', text: '', tags: 'one three b' },
      { title: 'Hello 5', text: '', tags: 'three c' },
      { title: 'Hello 6', text: '', tags: 'three c' },
    ];
    tiddlers.forEach((t) => wiki.addTiddler({ type: 'text/gemini', ...t }));
  }

  it('intersects config filter and param filter: [] [] => []', () => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/config/atomserver', text: 'https://example.com', type: 'text/plain' });
    addFixtureTiddlers(wiki);
    const noMatchFilter = '[tag[no-match]]';
    wiki.addTiddler({
      title: '$:/plugins/ento/gemini/config/filter',
      text: noMatchFilter,
      type: 'text/plain',
    });
    expect(wiki.filterTiddlers(noMatchFilter)).toEqual([]);
    const text = `<$text text=<<gemini-atomfeed filter:"${noMatchFilter}">>/>`;
    const wrapper = renderText(wiki, text);
    expect(wrapper.textContent).toBe(feed());
  });

  it('intersects config filter and param filter: [] [some2] => []', () => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/config/atomserver', text: 'https://example.com', type: 'text/plain' });
    addFixtureTiddlers(wiki);
    const noMatchFilter = '[tag[no-match]]';
    const someMatchFilter = '[tag[b]]';
    expect(wiki.filterTiddlers(noMatchFilter)).toEqual([]);
    expect(wiki.filterTiddlers(someMatchFilter)).toEqual(['Hello 3', 'Hello 4']);
    wiki.addTiddler({
      title: '$:/plugins/ento/gemini/config/filter',
      text: noMatchFilter,
      type: 'text/plain',
    });
    const text = `<$text text=<<gemini-atomfeed filter:"${someMatchFilter}">>/>`;
    const wrapper = renderText(wiki, text);
    expect(wrapper.textContent).toBe(feed());
  });

  it('intersects config filter and param filter: [some] [] => []', () => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/config/atomserver', text: 'https://example.com', type: 'text/plain' });
    addFixtureTiddlers(wiki);
    const noMatchFilter = '[tag[no-match]]';
    const someMatchFilter = '[tag[b]]';
    expect(wiki.filterTiddlers(noMatchFilter)).toEqual([]);
    expect(wiki.filterTiddlers(someMatchFilter)).toEqual(['Hello 3', 'Hello 4']);
    wiki.addTiddler({
      title: '$:/plugins/ento/gemini/config/filter',
      text: someMatchFilter,
      type: 'text/plain',
    });
    const text = `<$text text=<<gemini-atomfeed filter:"${noMatchFilter}">>/>`;
    const wrapper = renderText(wiki, text);
    expect(wrapper.textContent).toBe(feed());
  });

  it('intersects config filter and param filter: [some] < [some2] => [some]', () => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/config/atomserver', text: 'https://example.com', type: 'text/plain' });
    addFixtureTiddlers(wiki);
    const smallMatchFilter = '[tag[b]]';
    const bigMatchFilter = '[tag[three]]';
    expect(wiki.filterTiddlers(smallMatchFilter)).toEqual(['Hello 3', 'Hello 4']);
    expect(wiki.filterTiddlers(bigMatchFilter)).toEqual(['Hello 3', 'Hello 4', 'Hello 5', 'Hello 6']);
    wiki.addTiddler({
      title: '$:/plugins/ento/gemini/config/filter',
      text: smallMatchFilter,
      type: 'text/plain',
    });
    const text = `<$text text=<<gemini-atomfeed filter:"${bigMatchFilter}">>/>`;
    const wrapper = renderText(wiki, text);
    const entries = [
      { title: 'Hello 3', link: 'https://example.com/#Hello%203', id: '7e2f3ae2-744d-b56b-a992-54f7c7ed9687' },
      { title: 'Hello 4', link: 'https://example.com/#Hello%204', id: '0e0f3c5a-d940-69e7-0375-f6a707767392' },
    ];
    expect(wrapper.textContent).toBe(feed({ author: undefined }, entries));
  });

  it('intersects config filter and param filter: [some] = [some2] => [some]', () => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/config/atomserver', text: 'https://example.com', type: 'text/plain' });
    addFixtureTiddlers(wiki);
    const smallMatchFilter = '[tag[b]]';
    expect(wiki.filterTiddlers(smallMatchFilter)).toEqual(['Hello 3', 'Hello 4']);
    wiki.addTiddler({
      title: '$:/plugins/ento/gemini/config/filter',
      text: smallMatchFilter,
      type: 'text/plain',
    });
    const text = `<$text text=<<gemini-atomfeed filter:"${smallMatchFilter}">>/>`;
    const wrapper = renderText(wiki, text);
    const entries = [
      { title: 'Hello 3', link: 'https://example.com/#Hello%203', id: '7e2f3ae2-744d-b56b-a992-54f7c7ed9687' },
      { title: 'Hello 4', link: 'https://example.com/#Hello%204', id: '0e0f3c5a-d940-69e7-0375-f6a707767392' },
    ];
    expect(wrapper.textContent).toBe(feed({ author: undefined }, entries));
  });

  it('intersects config filter and param filter: [some] > [some2] => [some2]', () => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/config/atomserver', text: 'https://example.com', type: 'text/plain' });
    addFixtureTiddlers(wiki);
    const smallMatchFilter = '[tag[b]]';
    const bigMatchFilter = '[tag[three]]';
    expect(wiki.filterTiddlers(smallMatchFilter)).toEqual(['Hello 3', 'Hello 4']);
    expect(wiki.filterTiddlers(bigMatchFilter)).toEqual(['Hello 3', 'Hello 4', 'Hello 5', 'Hello 6']);
    wiki.addTiddler({
      title: '$:/plugins/ento/gemini/config/filter',
      text: bigMatchFilter,
      type: 'text/plain',
    });
    const text = `<$text text=<<gemini-atomfeed filter:"${smallMatchFilter}">>/>`;
    const wrapper = renderText(wiki, text);
    const entries = [
      { title: 'Hello 3', link: 'https://example.com/#Hello%203', id: '7e2f3ae2-744d-b56b-a992-54f7c7ed9687' },
      { title: 'Hello 4', link: 'https://example.com/#Hello%204', id: '0e0f3c5a-d940-69e7-0375-f6a707767392' },
    ];
    expect(wrapper.textContent).toBe(feed({ author: undefined }, entries));
  });

  it('intersects config filter and param filter: [some] != [some2] => []', () => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/config/atomserver', text: 'https://example.com', type: 'text/plain' });
    addFixtureTiddlers(wiki);
    const someMatchFilter = '[tag[b]]';
    const otherMatchFilter = '[tag[c]]';
    expect(wiki.filterTiddlers(someMatchFilter)).toEqual(['Hello 3', 'Hello 4']);
    expect(wiki.filterTiddlers(otherMatchFilter)).toEqual(['Hello 5', 'Hello 6']);
    wiki.addTiddler({
      title: '$:/plugins/ento/gemini/config/filter',
      text: someMatchFilter,
      type: 'text/plain',
    });
    const text = `<$text text=<<gemini-atomfeed filter:"${otherMatchFilter}">>/>`;
    const wrapper = renderText(wiki, text);
    expect(wrapper.textContent).toBe(feed());
  });

  it('intersects config filter and param filter: [some] ~  [some2] => [some & some2] (partial overlap)', () => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/config/atomserver', text: 'https://example.com', type: 'text/plain' });
    addFixtureTiddlers(wiki);
    const someMatchFilter = '[tag[one]]';
    const otherMatchFilter = '[tag[three]]';
    expect(wiki.filterTiddlers(someMatchFilter)).toEqual(['Hello 1', 'Hello 2', 'Hello 3', 'Hello 4']);
    expect(wiki.filterTiddlers(otherMatchFilter)).toEqual(['Hello 3', 'Hello 4', 'Hello 5', 'Hello 6']);
    wiki.addTiddler({
      title: '$:/plugins/ento/gemini/config/filter',
      text: someMatchFilter,
      type: 'text/plain',
    });
    const text = `<$text text=<<gemini-atomfeed filter:"${otherMatchFilter}">>/>`;
    const wrapper = renderText(wiki, text);
    const entries = [
      { title: 'Hello 3', link: 'https://example.com/#Hello%203', id: '7e2f3ae2-744d-b56b-a992-54f7c7ed9687' },
      { title: 'Hello 4', link: 'https://example.com/#Hello%204', id: '0e0f3c5a-d940-69e7-0375-f6a707767392' },
    ];
    expect(wrapper.textContent).toBe(feed({ author: undefined }, entries));
  });

  it('renders when config filter includes the feed tiddler itself', () => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/config/atomserver', text: 'https://example.com', type: 'text/plain' });
    addFixtureTiddlers(wiki);
    wiki.addTiddler({
      title: '$:/plugins/ento/gemini/config/filter',
      text: '$:/Feed [tag[b]]',
      type: 'text/plain',
    });
    wiki.addTiddler({
      title: '$:/Feed',
      text: '<$text text=<<gemini-atomfeed filter:"[limit[20]]">>/>',
      type: 'text/vnd.tiddlywiki',
    });
    const wrapper = wiki.renderTiddler(
      'text/plain', '$:/Feed', { variables: { currentTiddler: '$:/Feed' } },
    );
    const entries = [
      { title: 'Hello 3', link: 'https://example.com/#Hello%203', id: '7e2f3ae2-744d-b56b-a992-54f7c7ed9687' },
      { title: 'Hello 4', link: 'https://example.com/#Hello%204', id: '0e0f3c5a-d940-69e7-0375-f6a707767392' },
    ];
    expect(wrapper).toBe(feed({ author: undefined }, entries));
  });
});
