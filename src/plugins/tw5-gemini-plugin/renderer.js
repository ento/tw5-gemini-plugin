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

function visitNode(ctx, node, siblingIndex) {
  switch (node.nodeType) {
    case node.ELEMENT_NODE:
      // eslint-disable-next-line no-use-before-define
      visitElement(ctx, node, siblingIndex);
      break;
    case node.TEXT_NODE:
      if (ctx.isPre) {
        ctx.write(node.textContent);
      } else {
        ctx.write(node.textContent.replace(newlinesRegExp, '').replace(spacesRegExp, ' '));
      }
      break;
    default:
      break;
  }
}

function visitChildren(ctx, node) {
  $tw.utils.each(node.children, (child, index) => visitNode(ctx, child, index));
}

function visitHeading(ctx, node, level) {
  ctx.flushLinkReferences();
  ctx.block(node.tag, false, () => {
    ctx.write('#'.repeat(level));
    ctx.write(' ');
    visitChildren(ctx, node);
  });
}

function visitLink(ctx, node, siblingIndex) {
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
    console.log('link', 'in plain block', ctx.inPlainBlock, 'isSimpleTextLink', isSimpleTextLink, 'siblingIndex', siblingIndex);
  }
  if (ctx.inPlainBlock && isSimpleTextLink && siblingIndex === 0) {
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

function visitElement(ctx, node, siblingIndex) {
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
        visitChildren(ctx, node);
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
      visitLink(ctx, node, siblingIndex);
      break;
    case 'p':
    case 'ul':
      ctx.flushLinkReferences();
      ctx.block(node.tag, true, () => {
        visitChildren(ctx, node);
      });
      break;
    case 'pre':
      ctx.block(node.tag, false, () => {
        ctx.write('```\n');
        ctx.isPre = true;
        visitChildren(ctx, node);
        ctx.isPre = false;
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
    isPre: false,
    prefix: '',
    blockQuoteLevel: 0,
    hasSomethingWritten: true,
    justWroteNewline: false,
    linkReferences: new LinkReferences(),
  };
  ctx.write = function write(chunk, encoding, cb) {
    if (ctx.prefix.length > 0) {
      chunk.split('\n').forEach((line) => {
        if (enableTrace) {
          // eslint-disable-next-line no-console
          console.log('prefix', ctx.prefix);
        }
        stream.write(ctx.prefix, encoding, cb);
        if (enableTrace) {
          // eslint-disable-next-line no-console
          console.log('line', line);
        }
        stream.write(line, encoding, cb);
      });
    } else {
      stream.write(chunk, encoding, cb);
    }
    ctx.hasSomethingWritten = true;
    ctx.justWroteNewline = false;
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
  ctx.block = function block(trace, inPlainBlock, cb) {
    if (ctx.enableTrace) {
      // eslint-disable-next-line no-console
      console.log('block', trace, 'inPlainBlock', inPlainBlock);
    }
    const oldInPlainBlock = ctx.inPlainBlock;
    ctx.inPlainBlock = inPlainBlock;
    if (!ctx.justWroteNewline && !ctx.hasSomethingWritten) {
      ctx.nl(`block-pre ${trace}`);
    }
    cb();
    if (!ctx.justWroteNewline) {
      ctx.nl(`block-post ${trace}`);
    }
    ctx.inPlainBlock = oldInPlainBlock;
  };
  ctx.addLinkReference = function addLinkReference(href) {
    return ctx.linkReferences.add(href);
  };
  ctx.flushLinkReferences = function flushLinkReferences() {
    if (ctx.linkReferences.remainingCount > 0) {
      ctx.nl('linkrefs-pre');
      Array.from(ctx.linkReferences.flushRefs()).forEach(({ href, number }) => {
        ctx.write(`=> ${href} [${number}]`);
        ctx.nl('linkref-each');
      });
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
