/*\
title: $:/plugins/ento/gemini/atomfeed.js
type: application/javascript
module-type: macro

Macro to render tiddlers matching a filter as ATOM feed

\*/

// eslint-disable-next-line import/newline-after-import
const { optionalRequire } = require('$:/plugins/ento/gemini/utils.js');
const AtomSmasher = optionalRequire('$:/plugins/dullroar/atomfeed/atomsmasher');

function pathJoin(parts) {
  return parts.join('/').replace(/(:\/)*\/{1,}/g, '$1/');
}

exports.name = 'gemini-atomfeed';

exports.params = [
  { name: 'filter' },
  { name: 'title' },
  { name: 'subtitle' },
  { name: 'author' },
  { name: 'feedpath' },
];

exports.run = function run(filter, title, subtitle, author, feedpath) {
  const metadata = {
    title, subtitle, author, feedpath,
  };
  if (AtomSmasher) {
    const currentTiddlerTitle = this.getVariable('currentTiddler');
    const titles = this.wiki.filterTiddlers(filter)
      .filter((tiddlerTitle) => tiddlerTitle !== currentTiddlerTitle);
    return new AtomSmasher({
      wiki: this.wiki,
      document: this.document,
    })
      .entryHref((data, builder) => pathJoin([builder.metadata.sitehref, `/t/${encodeURIComponent(data.title)}`]))
      .feedify(titles, metadata);
  }
  throw new Error('This macro requires the dullroar/atomfeed plugin. Please install it and reboot/reload.');
};
