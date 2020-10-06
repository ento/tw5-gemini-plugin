/*\
title: $:/plugins/ento/gemini/renderer.js
type: application/javascript
module-type: library

Convert TiddlyWiki AST as Gemini text

\*/
/* global $tw: false */

const transform = require('$:/plugins/ento/gemini/transformer.js');

const spacesRegExp = /[ \t]+/g;
const newlinesRegExp = /[\r\n]+/g;

function visitNode(ctx, node, maxSiblingIndex) {
  switch (node.nodeType) {
    case node.ELEMENT_NODE:
      // eslint-disable-next-line no-use-before-define
      visitElement(ctx, node, maxSiblingIndex);
      break;
    case node.TEXT_NODE:
      if (ctx.enableTrace) {
        // eslint-disable-next-line no-console
        console.log('text', 'is pre', ctx.isPreformatted, JSON.stringify(node.textContent));
      }
      if (ctx.isPreformatted) {
        ctx.write(node.textContent);
      } else {
        ctx.write(node.textContent.replace(newlinesRegExp, ' ').replace(spacesRegExp, ' '));
      }
      break;
    default:
      break;
  }
}

function visitChildren(ctx, node) {
  const maxSiblingIndex = node.children.length - 1;
  $tw.utils.each(node.children, (child) => visitNode(ctx, child, maxSiblingIndex));
}

function visitHeading(ctx, node, level) {
  ctx.flushLinkReferences();
  ctx.block(node.tag, false, () => {
    ctx.write('#'.repeat(level));
    ctx.write(' ');
    visitChildren(ctx, node);
  });
}

function visitLink(ctx, node, maxSiblingIndex) {
  const href = node.getAttribute('href').trim();
  /*
   *               isTopLevelSimpleTextLink
   * inPlainBlock | true | false |
   *         true | =>   | [1]   |
   *        false | [1]  | [1]   |
   */
  const isSimpleTextLink = node.children.length === 1
        && node.children[0].nodeType === node.TEXT_NODE;
  if (ctx.enableTrace) {
    // eslint-disable-next-line no-console
    console.log('link', 'in plain block', ctx.inPlainBlock, 'isSimpleTextLink', isSimpleTextLink, 'maxSiblingIndex', maxSiblingIndex);
  }
  if (ctx.inPlainBlock && isSimpleTextLink && maxSiblingIndex === 0) {
    if (href.length > 0) {
      const linkText = node.children[0].textContent;
      let line = `=> ${href}`;
      if (linkText !== href) {
        line += ` ${linkText}`;
      }
      ctx.write(line);
    }
  } else {
    visitChildren(ctx, node);
    const refNumber = ctx.addLinkReference(href);
    ctx.write(` [${refNumber}]`);
  }
}

function visitElement(ctx, node, maxSiblingIndex) {
  switch (node.tag) {
    case 'br':
      ctx.nl();
      break;
    case 'h1':
      visitHeading(ctx, node, 1);
      break;
    case 'h2':
      visitHeading(ctx, node, 2);
      break;
    case 'h3':
      visitHeading(ctx, node, 3);
      break;
    case 'blockquote':
      ctx.flushLinkReferences();
      ctx.block(node.tag, false, () => {
        ctx.blockQuoteLevel += 1;
        ctx.prefix = `${'>'.repeat(ctx.blockQuoteLevel)} `;
        ctx.withState('isPreformatted', true, ctx.OR, () => {
          visitChildren(ctx, node);
        });
        ctx.blockQuoteLevel -= 1;
        ctx.prefix = '>'.repeat(ctx.blockQuoteLevel);
        if (ctx.blockquoteLevel > 0) {
          ctx.prefix += ' ';
        }
      });
      break;
    case 'div':
      ctx.block(node.tag, true, () => {
        visitChildren(ctx, node);
      });
      break;
    case 'li':
      ctx.block(node.tag, false, () => {
        ctx.write('* ');
        visitChildren(ctx, node);
      });
      break;
    case 'img':
      visitChildren(ctx, node);
      break;
    case 'a':
      visitLink(ctx, node, maxSiblingIndex);
      break;
    case 'p':
    case 'ul':
      ctx.flushLinkReferences();
      ctx.softNl('p-pre');
      ctx.block(node.tag, true, () => {
        visitChildren(ctx, node);
      });
      ctx.nl('p-post');
      break;
    case 'pre':
      ctx.block(node.tag, false, () => {
        ctx.write('```\n');
        ctx.isPreformatted = true;
        visitChildren(ctx, node);
        ctx.isPreformatted = false;
        ctx.write('\n```');
      });
      break;
    case 'head':
    case 'script':
    case 'style':
      break;
    default:
      visitChildren(ctx, node);
      break;
  }
}

class LinkReferences {
  constructor() {
    this.hrefs = [];
    this.flushedUpTo = -1;
  }

  add(href) {
    this.hrefs.push(href);
    return this.hrefs.length;
  }

  * flushRefs() {
    for (let i = this.flushedUpTo + 1; i < this.hrefs.length; i += 1) {
      yield { href: this.hrefs[i], number: i + 1 };
      this.flushedUpTo = i;
    }
  }

  get remainingCount() {
    return this.hrefs.length - 1 - this.flushedUpTo;
  }
}

/**
 * Convert DOM into Gemini text
 * @param {Node} dom DOM node
 * @param {Writable} stream Writable stream
 */
function domToGemtext(node, stream, enableTrace = false) {
  const ctx = {
    enableTrace,
    isPreformatted: false,
    prefix: '',
    blockQuoteLevel: 0,
    inPlainBlock: true,
    hasSomethingWritten: true,
    justWroteNewline: false,
    linkReferences: new LinkReferences(),
    AND: (a, b) => a && b,
    OR: (a, b) => a || b,
  };
  ctx.withState = function withState(property, newState, merge, cb) {
    const oldState = ctx[property];
    ctx[property] = merge(oldState, newState);
    try {
      cb();
    } finally {
      ctx[property] = oldState;
    }
  };
  ctx.write = function write(chunk, encoding, cb) {
    if (chunk.length === 0) {
      return;
    }
    const lines = chunk.split('\n');
    const emitFinalNewline = chunk.endsWith('\n');
    lines.forEach((line, i) => {
      stream.write(ctx.prefix, encoding, cb);
      stream.write(line, encoding, cb);
      ctx.justWroteNewline = false;
      if (i === lines.length - 1) {
        if (emitFinalNewline) {
          ctx.nl('line-end');
        }
      } else {
        ctx.nl('line-end');
      }
      if (enableTrace) {
        // eslint-disable-next-line no-console
        console.log('write', 'prefix', ctx.prefix, 'line', JSON.stringify(line));
      }
    });
    ctx.hasSomethingWritten = true;
  };
  ctx.nl = function nl(trace) {
    if (enableTrace) {
      // eslint-disable-next-line no-console
      console.log('nl', trace);
    }
    stream.write('\n');
    ctx.hasSomethingWritten = true;
    ctx.justWroteNewline = true;
  };
  ctx.softNl = function softNl(trace) {
    if (!ctx.justWroteNewline) {
      ctx.nl(`${trace} (soft)`);
    }
  };
  ctx.block = function block(trace, inPlainBlock, cb) {
    ctx.withState('inPlainBlock', inPlainBlock, ctx.AND, () => {
      if (ctx.enableTrace) {
        // eslint-disable-next-line no-console
        console.log('block', trace, 'inPlainBlock', ctx.inPlainBlock);
      }
      if (!ctx.hasSomethingWritten) {
        ctx.softNl(`block-pre ${trace}`);
      }
      cb();
      ctx.softNl(`block-post ${trace}`);
    });
  };
  ctx.addLinkReference = function addLinkReference(href) {
    return ctx.linkReferences.add(href);
  };
  ctx.flushLinkReferences = function flushLinkReferences() {
    if (ctx.linkReferences.remainingCount > 0) {
      ctx.softNl('linkrefs-pre');
      Array.from(ctx.linkReferences.flushRefs()).forEach(({ href, number }) => {
        ctx.write(`=> ${href} [${number}]`);
        ctx.nl('linkref-each');
      });
      ctx.nl('linkref-post');
    }
  };
  visitChildren(ctx, node);
  ctx.flushLinkReferences();
  return ctx.buffer;
}
exports.domToGemtext = domToGemtext;

/**
 * Render Tiddler as DOM, rewriting internal links.
 * @param {Wiki} wiki Wiki instance
 * @param {Tiddler} tiddler Tiddler to render
 * @param {Document} document DOM document
 */
function tiddlerToDom(wiki, tiddler, document) {
  const options = {
    document,
    importPageMacros: true,
    variables: { currentTiddler: tiddler.fields.title },
  };
  const widgetNode = wiki.makeTranscludeWidget(tiddler.fields.title, options);
  const container = document.createElement('div');
  widgetNode.render(container, null);
  transform.rewriteTiddlerLinks(container);
  return container.children[0];
}
exports.tiddlerToDom = tiddlerToDom;
