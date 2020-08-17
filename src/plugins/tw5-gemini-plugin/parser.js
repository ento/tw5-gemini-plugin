/*\
title: $:/plugins/ento/gemini/parser.js
type: application/javascript
module-type: parser

Parser for rendering Gemini text in TiddlyWiki

\*/

function TextLine(line) {
  this.text = line;
}

Object.defineProperty(TextLine.prototype, 'type', { value: 'TextLine' });

function LinkLine(line) {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return;
  }
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex > -1) {
    this.href = trimmed.slice(0, spaceIndex);
    this.title = trimmed.slice(spaceIndex).trim();
  } else {
    this.href = trimmed;
  }
}

LinkLine.prefix = /^=>/;
LinkLine.handle = function handle(nodes, _state, line) {
  nodes.push(new LinkLine(line.text.trimStart()));
};
Object.defineProperty(LinkLine.prototype, 'type', { value: 'LinkLine' });

function PreformattedTextLine(line, alt) {
  this.text = line;
  this.alt = alt;
}

PreformattedTextLine.prefix = /^```/;
PreformattedTextLine.handle = function handle(_nodes, state, line) {
  if (state.preformatted) {
    // eslint-disable-next-line no-param-reassign
    state.preformattedAlt = null;
  } else {
    // eslint-disable-next-line no-param-reassign
    state.preformattedAlt = line.text;
  }
  // eslint-disable-next-line no-param-reassign
  state.preformatted = !state.preformatted;
};
Object.defineProperty(PreformattedTextLine.prototype, 'type', { value: 'PreformattedTextLine' });

function HeadingLine(line, level) {
  this.text = line;
  this.level = level;
}

HeadingLine.prefix = /^(?<level>#{1,3})/;
HeadingLine.handle = function handle(nodes, _state, line) {
  nodes.push(new HeadingLine(line.text.trimStart(), line.prefix.groups.level.length));
};
Object.defineProperty(HeadingLine.prototype, 'type', { value: 'HeadingLine' });

function UnorderedListItemLine(line) {
  this.text = line;
}

UnorderedListItemLine.prefix = /^\* /;
UnorderedListItemLine.handle = function handle(nodes, _state, line) {
  nodes.push(new UnorderedListItemLine(line.text.trimStart()));
};
Object.defineProperty(UnorderedListItemLine.prototype, 'type', { value: 'UnorderedListItemLine' });

function QuoteLine(line) {
  this.text = line;
}

QuoteLine.prefix = /^>/;
QuoteLine.handle = function handle(nodes, _state, line) {
  nodes.push(new QuoteLine(line.text));
};
Object.defineProperty(QuoteLine.prototype, 'type', { value: 'QuoteLine' });

const LINE_TYPES = [
  PreformattedTextLine,
  LinkLine,
  HeadingLine,
  UnorderedListItemLine,
  QuoteLine,
];

function matches(line, lineType) {
  const match = line.match(lineType.prefix);
  if (match) {
    return { prefix: match, text: line.slice(match[0].length) };
  }
  return null;
}

/**
 * Given a text/gemini text, parse it into AST.
 */
function parse(text) {
  const state = { preformatted: false, preformattedAlt: null };
  const nodes = [];
  text.split('\n').forEach((line) => {
    if (line.length === 0) {
      nodes.push(new TextLine(line));
      return;
    }
    let match;
    if (state.preformatted) {
      match = matches(line, PreformattedTextLine);
      if (match) {
        PreformattedTextLine.handle(nodes, state, match);
      } else {
        nodes.push(new PreformattedTextLine(line, state.preformattedAlt));
      }
    } else {
      for (let i = 0; i < LINE_TYPES.length; i += 1) {
        const lineType = LINE_TYPES[i];
        match = matches(line, lineType);
        if (match) {
          lineType.handle(nodes, state, match);
          return;
        }
      }
      // No special line type matched; treat this as a normal text line
      nodes.push(new TextLine(line));
    }
  });
  return nodes;
}

/**
 * Convert the given array of Gemini AST into TiddlyWiki AST.
 */
function render(nodes) {
  const tree = [];
  let tip = null;
  const push = (node) => {
    tip = node;
    tree.push(node);
  };
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    switch (node.type) {
      case 'TextLine':
        if (node.text.length === 0) {
          push({ type: 'element', tag: 'br' });
        } else {
          push({ type: 'element', tag: 'p', children: [{ type: 'text', text: node.text }] });
        }
        break;
      case 'LinkLine':
        if (!node.href) {
          push({ type: 'element', tag: 'br' });
        } else if (node.href[0] === '#') {
          push(
            {
              type: 'element',
              tag: 'div',
              children: [{
                type: 'link',
                attributes: {
                  to: { type: 'string', value: decodeURI(node.href.substr(1)) },
                },
                children: [{ type: 'text', text: node.title || node.href.substr(1) }],
              }],
            },
          );
        } else {
          push(
            {
              type: 'element',
              tag: 'div',
              children: [{
                type: 'element',
                tag: 'a',
                attributes: {
                  target: { type: 'string', value: '_blank' },
                  rel: { type: 'string', value: 'noopen noreferrer' },
                  href: { type: 'string', value: node.href },
                },
                children: [{ type: 'text', text: node.title || node.href }],
              }],
            },
          );
        }
        break;
      case 'PreformattedTextLine':
        if (tip === null || tip.type !== 'codeblock') {
          const attributes = {
            code: { type: 'string', value: node.text },
          };
          if (node.alt) {
            attributes.language = { type: 'string', value: node.alt };
          }
          push({
            type: 'codeblock',
            attributes,
          });
        } else {
          tip.attributes.code.value += `\n${node.text}`;
        }
        break;
      case 'HeadingLine':
        push({
          type: 'element',
          tag: `h${Number(node.level).toString()}`,
          children: [{ type: 'text', text: node.text }],
        });
        break;
      case 'UnorderedListItemLine':
        if (tip.tag !== 'ul') {
          push({
            type: 'element',
            tag: 'ul',
            children: [],
          });
        }
        tip.children.push({
          type: 'element',
          tag: 'li',
          children: [{ type: 'text', text: node.text }],
        });
        break;
      case 'QuoteLine':
        if (tip.tag !== 'blockquote') {
          push({
            type: 'element',
            tag: 'blockquote',
            children: [],
          });
        }
        tip.children.push({
          type: 'element',
          tag: 'div',
          children: [{ type: 'text', text: node.text }],
        });
        break;
      default:
        throw new Error(`Unknown node type ${node.type}`);
    }
  }
  return tree;
}

function GeminiParser(type, text) {
  const nodes = parse(text);
  this.tree = render(nodes);
}

exports['text/gemini'] = GeminiParser;
