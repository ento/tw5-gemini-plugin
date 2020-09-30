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
    const req = { url: '/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 text/plain\r\n## heading');
    server.requestHandler(req, res);
  });

  it('understands URL encoding', (done) => {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, { config: { 'root-tiddler': 'root' } });
    wiki.addTiddler({ title: 'Hello World', text: '## heading', type: 'text/plain' });
    const req = { url: '/t/Hello%20World' };
    const res = createResponse();
    expectResponse(res, done, '20 text/plain\r\n## heading');
    server.requestHandler(req, res);
  });

  it('serves tiddler with filter', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/plugins/ento/gemini/config/filter', text: '[type[text/gemini]]', type: 'text/vnd.tiddlywiki' });
    wiki.addTiddler({ title: 'Hello', text: '## heading', type: 'text/gemini' });
    const server = new Server(wiki, null, {});
    const req = { url: '/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 text/gemini\r\n# Hello\n## heading');
    server.requestHandler(req, res);
  });

  it('filters out which tiddler to serve', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/plugins/ento/gemini/config/filter', text: '[type[text/gemini]]', type: 'text/vnd.tiddlywiki' });
    wiki.addTiddler({ title: 'Hello', text: '# heading', type: 'text/plain' });
    const server = new Server(wiki, null, {});
    const req = { url: '/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '51 \r\n');
    server.requestHandler(req, res);
  });

  it('when type is text/gemini, use gemini-mime-type as the mime-type', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({
      title: 'Hello',
      text: '# heading',
      type: 'text/gemini',
      'gemini-mime-type': 'some/mime',
    });
    const server = new Server(wiki, null, {});
    const req = { url: '/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 some/mime\r\n# Hello\n# heading');
    server.requestHandler(req, res);
  });

  it('when type != text/gemini, no gemini/render-type, use passthru rendering', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({
      title: 'Hello',
      text: '# heading',
      type: 'text/plain',
      'gemini-mime-type': 'some/mime',
    });
    const server = new Server(wiki, null, {});
    const req = { url: '/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 some/mime\r\n# heading');
    server.requestHandler(req, res);
  });

  it('when type != text/gemini, gemini/render-type == text/html, let TiddlyWiki render', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({
      title: 'Hello',
      text: '# list',
      type: 'text/vnd.tiddlywiki',
      'gemini-render-type': 'text/html',
      'gemini-mime-type': 'some/mime',
    });
    const server = new Server(wiki, null, {});
    const req = { url: '/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 some/mime\r\n<ol><li>list</li></ol>');
    server.requestHandler(req, res);
  });

  it('when type != text/gemini, gemini/render-type != text/html, let TiddlyWiki render', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({
      title: 'Hello',
      text: '# list',
      type: 'text/vnd.tiddlywiki',
      'gemini-render-type': 'some/mime-not-html',
      'gemini-mime-type': 'some/mime',
    });
    const server = new Server(wiki, null, {});
    const req = { url: '/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 some/mime\r\nlist');
    server.requestHandler(req, res);
  });

  it('when letting TiddlyWiki render, currentTiddler variable is available', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({
      title: 'Hello',
      text: '<$view tiddler=<<currentTiddler>> field=title/>',
      type: 'text/vnd.tiddlywiki',
      'gemini-render-type': 'some/mime-not-html',
      'gemini-mime-type': 'some/mime',
    });
    const server = new Server(wiki, null, {});
    const req = { url: '/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 some/mime\r\nHello');
    server.requestHandler(req, res);
  });
});
