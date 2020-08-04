/*\
title: test_server.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Test Gemini server
\*/

/*global $tw: false */
"use strict";

const Server = require("$:/plugins/ento/gemini/server.js").Server;
const createResponse = require("@derhuerst/gemini/lib/response");

describe("tw5-gemini-plugin server", function() {
  it("serves root tiddler", function() {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, {config: {"root-tiddler": "Hello"}});
    wiki.addTiddler({title: "Hello", text: "# heading", type: "text/gemini"});
    const req = {url: "/"};
    const res = createResponse();
    const spiedMethod = spyOn(res, "end");
    server.requestHandler(req, res);
    expect(spiedMethod).toHaveBeenCalledWith("# heading");
  });

  it("serves non-root tiddler", function() {
    const wiki = new $tw.Wiki();
    const server = new Server(wiki, null, {config: {"root-tiddler": "root"}});
    wiki.addTiddler({title: "Hello", text: "# heading", type: "text/plain"});
    const req = {url: "/#Hello"};
    const res = createResponse();
    const spiedMethod = spyOn(res, "end");
    server.requestHandler(req, res);
    expect(spiedMethod).toHaveBeenCalledWith("# heading");
  });

  it("serves tiddler with filter", function() {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({title: "$:/plugins/ento/gemini/config/filter", text: "[type[text/gemini]]", type: "text/vnd.tiddlywiki"});
    wiki.addTiddler({title: "Hello", text: "# heading", type: "text/gemini"});
    const server = new Server(wiki, null, {});
    const req = {url: "/#Hello"};
    const res = createResponse();
    const spiedMethod = spyOn(res, "end");
    server.requestHandler(req, res);
    expect(spiedMethod).toHaveBeenCalledWith("# heading");
  });

  it("filters out which tiddler to serve", function() {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({title: "$:/plugins/ento/gemini/config/filter", text: "[type[text/gemini]]", type: "text/vnd.tiddlywiki"});
    wiki.addTiddler({title: "Hello", text: "# heading", type: "text/plain"});
    const server = new Server(wiki, null, {});
    const req = {url: "/#Hello"};
    const res = createResponse();
    const spiedMethod = spyOn(res, "notFound");
    server.requestHandler(req, res);
    expect(spiedMethod).toHaveBeenCalledWith();
  });

});
