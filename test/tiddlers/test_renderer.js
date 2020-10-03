/*\
title: test_renderer.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Test Gemini renderer
\*/

/* global $tw: false */

const { PassThrough } = require('stream');
const { domToGemtext } = require('$:/plugins/ento/gemini/renderer.js');

function expectStreamData(res, expected, done) {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('finish', () => {
    expect(body).toEqual(expected);
    done();
  });
}

function expectRenderResult(fields, expected, done) {
  const wiki = new $tw.Wiki();
  wiki.addTiddler(fields);
  const tiddler = wiki.getTiddler(fields.title);
  // parse and render as dom
  const options = { variables: { currentTiddler: tiddler.fields.title } };
  const parser = wiki.parseText(tiddler.fields.type, tiddler.fields.text, options);
  const widgetNode = wiki.makeWidget(parser, options);
  const container = $tw.fakeDocument.createElement('div');
  widgetNode.render(container, null);
  // call the renderer
  const res = new PassThrough();
  expectStreamData(res, expected, done);
  domToGemtext(container, res);
  res.end();
}

describe('renderer', () => {
  it('renders gemini features', (done) => {
    const text = `text line
=> gemini://localhost/
=> /hello link title

\`\`\`python
def foo(): pass
\`\`\`

# h1
## heading 2
### heading 3
#### heading 4

* unordered
* list

> quote
> lines

closing line
`;
    const expected = `text line
=> gemini://localhost/
=> /hello link title

\`\`\`
def foo(): pass
\`\`\`

# h1
## heading 2
### heading 3
### # heading 4

* unordered
* list

> quote
> lines

closing line
`;
    const fields = {
      text,
      title: 'Hello',
      type: 'text/gemini',
    };
    expectRenderResult(fields, expected, done);
  });

  it('renders html link reference', (done) => {
    const text = `a<br>
b<br>
c <a href="http://example.com">example</a>
`;
    const expected = `a
b
c example [1]

=> http://example.com [1]
`;
    const fields = {
      text,
      title: 'Hello',
      type: 'text/vnd.tiddlywiki',
    };
    expectRenderResult(fields, expected, done);
  });
});
