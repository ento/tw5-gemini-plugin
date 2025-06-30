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
  it('[URLRelative] Relative URLs should not be accepted by the server', (done) => {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, { config: { 'root-tiddler': 'Hello' } });
    const req = { url: '/' };
    const res = createResponse();
    expectResponse(res, done, '59 Invalid URL\r\n');
    server.requestHandler(req, res);
  });

  it('[HomepageRedirect] A URL with no trailing slash should redirect to the canonical resource', (done) => {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, { config: { 'root-tiddler': 'Hello' } });
    const req = { url: 'gemini://localhost' };
    const res = createResponse();
    expectResponse(res, done, '31 gemini://localhost/\r\n');
    server.requestHandler(req, res);
  });

  it('[URLSchemeMissing] A URL without a scheme should be inferred as gemini', (done) => {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, { config: { 'root-tiddler': 'Hello' } });
    wiki.addTiddler({ title: 'Hello', text: '## heading', type: 'text/gemini' });
    const req = { url: '//localhost/' };
    const res = createResponse();
    expectResponse(res, done, '20 text/gemini\r\n## heading\n');
    server.requestHandler(req, res);
  });

  it('returns error response when request handler errors', (done) => {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, { config: { 'root-tiddler': 'Hello' } });
    server.doRequestHandler = () => {
      throw new Error('test error');
    };
    const req = { url: 'gemini://localhost/' };
    const res = createResponse();
    expectResponse(res, done, '40 \r\n');
    server.requestHandler(req, res);
  });

  it('serves root tiddler', (done) => {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, { config: { 'root-tiddler': 'Hello' } });
    wiki.addTiddler({ title: 'Hello', text: '## heading', type: 'text/gemini' });
    const req = { url: 'gemini://localhost/' };
    const res = createResponse();
    expectResponse(res, done, '20 text/gemini\r\n## heading\n');
    server.requestHandler(req, res);
  });

  it('sets the lang parameter', (done) => {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, { config: { 'root-tiddler': 'Hello' } });
    wiki.addTiddler({
      title: 'Hello', text: '## heading', type: 'text/gemini', lang: 'ja',
    });
    const req = { url: 'gemini://localhost/' };
    const res = createResponse();
    expectResponse(res, done, '20 text/gemini; lang=ja\r\n## heading\n');
    server.requestHandler(req, res);
  });

  it('serves non-root tiddler', (done) => {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, { config: { 'root-tiddler': 'root' } });
    wiki.addTiddler({ title: 'Hello', text: '## heading', type: 'text/plain' });
    const req = { url: 'gemini://localhost/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 text/plain\r\n## heading');
    server.requestHandler(req, res);
  });

  it('understands URL encoding', (done) => {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, { config: { 'root-tiddler': 'root' } });
    wiki.addTiddler({ title: 'Hello World', text: '## heading', type: 'text/plain' });
    const req = { url: 'gemini://localhost/t/Hello%20World' };
    const res = createResponse();
    expectResponse(res, done, '20 text/plain\r\n## heading');
    server.requestHandler(req, res);
  });

  it('serves tiddler with filter', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/plugins/ento/gemini/config/filter', text: '[type[text/gemini]]', type: 'text/vnd.tiddlywiki' });
    wiki.addTiddler({ title: 'Hello', text: '## heading', type: 'text/gemini' });
    const server = new Server(wiki, null, {});
    const req = { url: 'gemini://localhost/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 text/gemini\r\n## heading\n');
    server.requestHandler(req, res);
  });

  it('filters out which tiddler to serve', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/plugins/ento/gemini/config/filter', text: '[type[text/gemini]]', type: 'text/vnd.tiddlywiki' });
    wiki.addTiddler({ title: 'Hello', text: '# heading', type: 'text/plain' });
    const server = new Server(wiki, null, {});
    const req = { url: 'gemini://localhost/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '51 \r\n');
    server.requestHandler(req, res);
  });

  it('serves tiddler with filter with exact title match', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/plugins/ento/gemini/config/filter', text: 'Hello [type[text/gemini]]', type: 'text/vnd.tiddlywiki' });
    wiki.addTiddler({ title: 'Hello', text: '## heading', type: 'text/plain' });
    const server = new Server(wiki, null, {});
    const req = { url: 'gemini://localhost/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 text/plain\r\n## heading');
    server.requestHandler(req, res);
  });

  it('does not serve tiddler just because the filter includes the title', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/plugins/ento/gemini/config/filter', text: 'Hello [type[text/gemini]]', type: 'text/plain' });
    wiki.addTiddler({ title: 'Hello', text: '# Hello', type: 'text/plain' });
    const server = new Server(wiki, null, {});
    const req = { url: 'gemini://localhost/t/Foo' };
    const res = createResponse();
    expectResponse(res, done, '51 \r\n');
    server.requestHandler(req, res);
  });

  it('renders vnd.tiddlywiki', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({
      title: 'Hello',
      text: '<$list>',
      type: 'text/vnd.tiddlywiki',
    });
    const server = new Server(wiki, null, {});
    const req = { url: 'gemini://localhost/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 text/gemini\r\n=> /t/Hello Hello\n\n');
    server.requestHandler(req, res);
  });

  it('rewrites internal links', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({
      title: 'Hello World',
      text: '=> #Hello%20World',
      type: 'text/gemini',
    });
    const server = new Server(wiki, null, {});
    const req = { url: 'gemini://localhost/t/Hello%20World' };
    const res = createResponse();
    expectResponse(res, done, '20 text/gemini\r\n=> /t/Hello%20World Hello World\n');
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
    const req = { url: 'gemini://localhost/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 some/mime\r\n# heading\n');
    server.requestHandler(req, res);
  });

  it('when type != text/gemini, no gemini/renderer, use passthru rendering', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({
      title: 'Hello',
      text: '# heading',
      type: 'text/plain',
      'gemini-mime-type': 'some/mime',
    });
    const server = new Server(wiki, null, {});
    const req = { url: 'gemini://localhost/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 some/mime\r\n# heading');
    server.requestHandler(req, res);
  });

  it('when type != text/gemini, gemini/renderer == text/html, let TiddlyWiki render', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({
      title: 'Hello',
      text: '# list',
      type: 'text/vnd.tiddlywiki',
      'gemini-renderer': 'text/html',
      'gemini-mime-type': 'some/mime',
    });
    const server = new Server(wiki, null, {});
    const req = { url: 'gemini://localhost/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 some/mime\r\n<ol><li>list</li></ol>');
    server.requestHandler(req, res);
  });

  it('when type != text/gemini, gemini/renderer != text/html, let TiddlyWiki render', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({
      title: 'Hello',
      text: '# list',
      type: 'text/vnd.tiddlywiki',
      'gemini-renderer': 'some/mime-not-html',
      'gemini-mime-type': 'some/mime',
    });
    const server = new Server(wiki, null, {});
    const req = { url: 'gemini://localhost/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 some/mime\r\n* list\n');
    server.requestHandler(req, res);
  });

  it('when letting TiddlyWiki render, currentTiddler variable is available', (done) => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({
      title: 'Hello',
      text: '<$view tiddler=<<currentTiddler>> field=title/>',
      type: 'text/vnd.tiddlywiki',
      'gemini-renderer': 'some/mime-not-html',
      'gemini-mime-type': 'some/mime',
    });
    const server = new Server(wiki, null, {});
    const req = { url: 'gemini://localhost/t/Hello' };
    const res = createResponse();
    expectResponse(res, done, '20 some/mime\r\nHello\n\n');
    server.requestHandler(req, res);
  });
});
