# LR parser written in TypeScript
LR(1) parser generator with a user-friendly formalism for specifying grammars,
written in TypeScript. Mostly for personal use.

## Installation
```bash
npm install lr-parser-typescript
```

## Example:

```typescript
import {
  Tokenizer, IdentifierToken, MergedTokens, SyntaxTreeNode,
  Parser, Caten, Match, Repeat,
} from 'lr-parser-typescript';


// You can create your own tokenizer class if you want.
export const tokenizer = new Tokenizer(<const>[
  'identifier', // This one is mandatory.
  'import',
  'number', // This one is mandatory.
  'from',
  'text', // This one is mandatory.
  '{',
  '}',
  '/',
  '"',
  ',',
  ';',
]);

export const token = tokenizer.token.bind(tokenizer);

class SimpleImport extends SyntaxTreeNode {
  identifiers: IdentifierToken[];
  path: MergedTokens;
  
  static rule = new Caten( // Caten ~~ conCATENate.
    token('import'),
    
    token('{'),
    new Repeat(
      new Match( true, 'identifiers', token('identifier') ),
      token(','),
    ),
    token('}'),
    
    token('from'),
    
    token('"'),
    new Match(
      false,
      'path',
      new Repeat(
        token('identifier'),
        token('/'),
      ),
    ),
    token('"'),
    token(';'),
  );
}

const parser = new Parser(tokenizer, SimpleImport);

parser.parse(' import { asdf } from "a/b/c"; ');
/*/
  SimpleImport {
    parent: null,
    identifiers: [
      IdentifierToken {
        start: SrcPosition { line: 0, col: 10, i: 10 },
        end: SrcPosition { line: 0, col: 14, i: 14 },
        value: 'asdf',
        kind: TokenKind { token: 'identifier', kind: 'TokenKind' }
      }
    ],
    path: {
      start: SrcPosition { line: 0, col: 23, i: 23 },
      end: SrcPosition { line: 0, col: 28, i: 28 },
      value: 'a/b/c',
      tokenKind: null
    }
  }
/*/

parser.parse(' import asdf from "a/b/c"; ');
/*/
  // Returns the token that could not be read.
  
  IdentifierToken {
    start: SrcPosition { line: 0, col: 8, i: 8 },
    end: SrcPosition { line: 0, col: 12, i: 12 },
    value: 'asdf',
    kind: TokenKind { token: 'identifier', kind: 'TokenKind' }
  }
/*/

```

## Reference

### SyntaxTreeNode
The class that your "nonterminals" need to extend.

### Parser<TokenString extends string, Stc extends SyntaxTreeClass>

#### constructor(tokenizer: Tokenizer<TokenString>, stc: Stc)

#### parse(word: string)

Return types: `InstanceType<Stc>` - word parsed, `Token<...>` first token that
could not be read (parse error), `TokenizationError` - error returned by the
tokenizer, `null` - returned when all tokens have been read, but the word does
not conform to the grammar.

### Tokenizer + tokenss
You can create/use your own if you want.

TODO Tokenizer, Token, IdentifierToken, NumberToken, TextToken, MergedTokens

### Patterns
#### Caten(...exprs: Pattern[])
Concatenation of several patterns.

#### Or(...exprs: Pattern[])
Matches if one of the patterns matches.

#### Maybe(expr: Pattern)
Matches the pattern, or an empty string.

#### Repeat(expr: Pattern, delimiter: Pattern, min: number, max: number)

`expr`: pattern to repeat.

`delimiter`: delimiter pattern. Default argument: `new Caten()`.

`min`: minimum number of repetitions. Default argument: `0`.

`max`: maximum number of repetitions. Default argument: `Infinity`.

#### Match(isArray: boolean, prop: string, match: SyntaxTreeClass | Pattern)

`isArray`: if true, matches will be returned in an array. Can be used inside
a repeat pattern. If false, can be used zero (will match `null`) or one time;
using it multiple times will throw an ugly undecipherable error.

`prop`: name of the prop of the class where the match will be assigned (see example).

`match`: what to match. If a pattern, the matched value will conform to the
`MergedTokens` interface.

## Debugging grammar conflicts
Debugging grammar conflicts can be a pain, and this tool does not make the
task easier - to find out what went wrong, you might need to open a debugger
and inspect the internals of this library (it's fairly small). That of course
requires some basic understanding of how LR parsers work. Or you can try to fiddle
with your grammar til it works.

## Future work
I plan to create a parser that supports finite number of attributes, and has
more friendly error messages. Probably not in the immediate future, though.
I might make the debugging easier if there happens to be popular support.
