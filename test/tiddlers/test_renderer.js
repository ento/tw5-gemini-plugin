/*\
title: test_renderer.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Test Gemini renderer using the golden test method.

When a golden tiddler is not found, the test harness will save
a new tiddler and its meta file in test/tiddlers/. Please move
them to test/tiddlers/renderer_golden_test/ to keep the top-level
directory organized. Here's a handy oneliner:

\*/
/* global $tw: false */

const { PassThrough } = require('stream');
const { domToGemtext } = require('$:/plugins/ento/gemini/renderer.js');

function onStreamFinish(stream, callback) {
  let body = '';
  stream.on('data', (chunk) => {
    body += chunk;
  });
  stream.on('finish', () => {
    callback(body);
  });
}

function expectStreamData(res, expected, done) {
  onStreamFinish(res, (body) => {
    expect(body.trim().split('\n')).toEqual(expected.trim().split('\n'));
    expect(Math.abs(body.length - expected.length)).toBeLessThan(2);
    done();
  });
}

const INPUT_TIDDLER_TAG = 'renderer-golden-input';
const OUTPUT_TIDDLER_TAG = 'renderer-golden-output';

function goldenTest(inputTitle, done) {
  const inputTiddler = $tw.wiki.getTiddler(inputTitle);
  const goldenTitle = `${inputTiddler.fields.title}_golden`;
  const golden = $tw.wiki.filterTiddlers(
    `[title[${goldenTitle}]tag[${OUTPUT_TIDDLER_TAG}]]`,
  );
  // parse and render as dom
  const options = { variables: { currentTiddler: inputTiddler.fields.title } };
  const parser = $tw.wiki.parseText(inputTiddler.fields.type, inputTiddler.fields.text, options);
  const widgetNode = $tw.wiki.makeWidget(parser, options);
  const container = $tw.fakeDocument.createElement('div');
  widgetNode.render(container, null);
  // call the renderer
  const res = new PassThrough();
  if (golden.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`Golden test output not found, saving the computed output as golden.
Please move the output to the golden test directory with:

mv test/tiddlers/*.gmi* test/tiddlers/renderer_golden_test/
`);
    onStreamFinish(res, (body) => {
      $tw.wiki.addTiddler({
        title: goldenTitle,
        text: body,
        type: 'text/gemini',
        tags: [OUTPUT_TIDDLER_TAG],
      });
      done();
    });
  } else if (golden.length === 1) {
    const goldenTiddler = $tw.wiki.getTiddler(golden[0]);
    expectStreamData(res, goldenTiddler.fields.text, done);
  } else {
    expect(false).toEqual(true, `At most one corresponding golden tiddler is expected, but found ${golden.length}. Please delete the excess ones.`);
  }
  domToGemtext(container, res);
  res.end();
}

describe('renderer', () => {
  $tw.utils.each($tw.wiki.filterTiddlers(`[tag[${INPUT_TIDDLER_TAG}]]`), (input) => {
    it(`golden test: ${input}`, (done) => {
      goldenTest(input, done);
    });
  });
});
