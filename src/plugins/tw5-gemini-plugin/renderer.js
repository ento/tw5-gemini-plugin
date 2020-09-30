/*\
title: $:/plugins/ento/gemini/renderer.js
type: application/javascript
module-type: library

Convert TiddlyWiki AST as Gemini text

\*/
/* global $tw: false */

function visitNode(ctx, node) {
  switch (node.nodeType) {
    case node.ELEMENT_NODE:
      // eslint-disable-next-line no-use-before-define
      visitElement(ctx, node);
      break;
    case node.TEXT_NODE:
      ctx.write(node.textContent);
      break;
    default:
      break;
  }
}

function visitChildren(ctx, node) {
  $tw.utils.each(node.children, (child) => visitNode(ctx, child));
}

function visitHeading(ctx, node, level) {
  ctx.write('#'.repeat(level));
  ctx.write(' ');
  visitChildren(ctx, node);
  ctx.nl();
}

function visitElement(ctx, node) {
  switch (node.tag) {
    case 'h1':
      visitHeading(ctx, node, 1);
      break;
    case 'h2':
      visitHeading(ctx, node, 2);
      break;
    case 'h3':
      visitHeading(ctx, node, 3);
      break;
    default:
      visitChildren(ctx, node);
      break;
  }
}

/**
 * Convert DOM into Gemini text
 * @param {Node} dom DOM node
 * @param {Writable} stream Writable stream
 */
function render(node, stream) {
  const ctx = {
    write: stream.write.bind(stream),
    nl: () => stream.write('\n'),
  };
  visitChildren(ctx, node);
  return ctx.buffer;
}

exports.render = render;
