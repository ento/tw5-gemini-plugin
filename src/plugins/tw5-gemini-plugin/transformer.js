/*\
title: $:/plugins/ento/gemini/transformer.js
type: application/javascript
module-type: library

Transform TiddlyWiki AST

\*/

exports.rewriteTiddlerLinks = (container) => {
  function visitNode(node) {
    switch (node.tag) {
      case 'a': {
        const href = node.getAttribute('href');
        if (href && href.length > 0 && href[0] === '#') {
          node.setAttribute('href', `/t/${href.substring(1)}`);
        }
        break;
      }
      default:
        break;
    }
    if (node.children) {
      // eslint-disable-next-line no-use-before-define
      visitNodes(node.children);
    }
  }

  function visitNodes(nodes) {
    Array.from(nodes).forEach((node) => {
      visitNode(node);
    });
  }

  visitNode(container);
  return container;
};
