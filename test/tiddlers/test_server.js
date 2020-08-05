/*\
title: test_server.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Test Gemini server
\*/

/* global $tw: false */

const createResponse = require('@derhuerst/gemini/lib/response');
const { Server } = require('$:/plugins/ento/gemini/server.js');

function expectResponse(res, done, expected) {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    expect(body).toEqual(expected);
    done();
  });
}

describe('tw5-gemini-plugin server', () => {
  it('serves root tiddler', (done) => {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, { config: { 'root-tiddler': 'Hello' } });
    wiki.addTiddler({ title: 'Hello', text: '## heading', type: 'text/gemini' });
    const req = { url: '/' };
    const res = createResponse();
    expectResponse(res, done, '20 text/gemini\r\n# Hello\n## heading');
    server.requestHandler(req, res);
  });

  it('sets the lang parameter', (done) => {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, { config: { 'root-tiddler': 'Hello' } });
    wiki.addTiddler({
      title: 'Hello', text: '## heading', type: 'text/gemini', lang: 'ja',
    });
    const req = { url: '/' };
    const res = createResponse();
    expectResponse(res, done, '20 text/gemini; lang=ja\r\n# Hello\n## heading');
    server.requestHandler(req, res);
  });

  it('serves non-root tiddler', (done) => {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, { config: { 'root-tiddler': 'root' } });
    wiki.addTiddler({ title: 'Hello', text: '## heading', type: 'text/plain' });
    const req = { url: '/#Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 text/plain\r\n# Hello\n## heading');
    server.requestHandler(req, res);
  });

  it('understands URL encoding', (done) => {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, { config: { 'root-tiddler': 'root' } });
    wiki.addTiddler({ title: 'Hello World', text: '## heading', type: 'text/plain' });
    const req = { url: '/#Hello%20World' };
    const res = createResponse();
    expectResponse(res, done, '20 text/plain\r\n# Hello World\n## heading');
    server.requestHandler(req, res);
  });

  it('serves tiddler with filter', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/plugins/ento/gemini/config/filter', text: '[type[text/gemini]]', type: 'text/vnd.tiddlywiki' });
    wiki.addTiddler({ title: 'Hello', text: '## heading', type: 'text/gemini' });
    const server = new Server(wiki, null, {});
    const req = { url: '/#Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 text/gemini\r\n# Hello\n## heading');
    server.requestHandler(req, res);
  });

  it('filters out which tiddler to serve', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/plugins/ento/gemini/config/filter', text: '[type[text/gemini]]', type: 'text/vnd.tiddlywiki' });
    wiki.addTiddler({ title: 'Hello', text: '# heading', type: 'text/plain' });
    const server = new Server(wiki, null, {});
    const req = { url: '/#Hello' };
    const res = createResponse();
    expectResponse(res, done, '51 \r\n');
    server.requestHandler(req, res);
  });
});
