/*\
title: $:/plugins/ento/gemini/atomfeed.js
type: application/javascript
module-type: macro

Macro to render tiddlers matching a filter as ATOM feed

\*/

function optionalRequire(moduleName) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(moduleName);
  } catch (e) {
    return null;
  }
}

const AtomSmasher = optionalRequire('$:/plugins/dullroar/atomfeed/atomsmasher');

function geminiAlternate(entry, data) {
  return entry.add('link')
    .attr('rel', 'alternate')
    .attr('type', 'text/gemini')
    .attr('href', data.href)
    .end();
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
    const runs = ['[!is[system]!has[draft.of]]'];
    const configFilter = this.wiki.getTiddlerText('$:/plugins/ento/gemini/config/filter') || '';
    if (configFilter.trim()) {
      runs.push(`+${configFilter}`);
    }
    if (filter.trim()) {
      runs.push(`+${filter}`);
    }
    const currentTiddlerTitle = this.getVariable('currentTiddler');
    const titles = this.wiki.filterTiddlers(runs.join(' '))
      .filter((tiddlerTitle) => tiddlerTitle !== currentTiddlerTitle);
    return new AtomSmasher({
      wiki: this.wiki,
      document: this.document,
      extensions: {
        entry: [geminiAlternate],
      },
    })
      .feedify(titles, metadata);
  }
  throw new Error('This macro requires the dullroar/atomfeed plugin. Please install it and reboot/reload.');
};
