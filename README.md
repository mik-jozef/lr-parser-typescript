# A minimal LR parsing library written in TypeScript
`lr-parser-typescript` is a parsing library that offers a
user-friendly  formalism for specifying grammars, and a simple API
for parsing strings,  written in TypeScript.

Under the hood, `lr-parser-typescript` uses a minimal LR(1) parser
algorithm described by David Pager in [0]. A minimal LR(1) parser
has the full power of the classic LR(1) parser, while producing
parser tables with sizes close to the corresponding LR(0) tables.

<!--Try online at: TODO.-->

## Installation
```bash
# Using npm:
npm install lr-parser-typescript

# Using yarn:
yarn add lr-parser-typescript
```

## Example:

```ts
import { Caten, Match, Maybe, Parser, SyntaxTreeNode, Token } from "lr-parser-typescript";

class B extends SyntaxTreeNode {
  token!: Token<'b'> | null;
  
  static rule = new Maybe(
    new Match('token', 'b'),
  );
}

class C extends SyntaxTreeNode {
  static rule = 'c';
}

class StartingSymbol extends SyntaxTreeNode {
  childNode!: B;
  
  static rule = new Caten( // "Caten" stands for "concatenate".
    'a',
    new Match('childNode', B),
    new Match(null, C),
    'd'
  );
}

const parser = new Parser(StartingSymbol);
const abcd = parser.parse('abcd')

console.log(abcd instanceof StartingSymbol); // true
```

## Tokens
Before a string is parsed, it is tokenized -- turned into a sequence
of instances of `Token`. The default tokenizer splits the string
into single-character tokens. If you want a more sophisticated
tokenizer, you need to create your own.
See the section [An example tokenizer](#an-example-tokenizer).

### The `Token<Kind extends string | null>` class
Constructor parameters:
* `public kind: Kind` 
* `public start: SrcPosition`
* `public end: SrcPosition`

The kind "null" should be reserved for "end of input" tokens.

Methods:
* `traverse<T>(this: T, fn: (node: T) => boolean | void)`
  
  Calls the function `fn` with `this` as an argument. Traversing
  makes more sense on instances of SyntaxTreeNode, a class that
  is mentioned below.

## Patterns
A pattern is either a string, or an instance of one of the classes
described below. A string pattern matches a token whose `kind`
property is equal to the string.

### Caten
Constructor parameters:
* `...patterns: Pattern[]`

`Caten` is short for "concatenate". `new Caten(p0, p1, p2)` matches
a sequence of tokens `s` iff `s` can be split into three subsequences
`s0`, `s1`, `s2` such that `pX` matches `sX` (for `X = 0, 1, 2`).

### Or
Constructor parameters:
* `...patterns: (Pattern | { patternName: string })[]`

`Or` matches a token sequence iff at least one of its arguments does.

At most one of the arguments can be an object with a `patternName`
property. See the section [Pattern caching](#pattern-caching) for
more about naming patterns.

### Maybe
Constructor parameters:
* `pattern: Pattern`
* `name: string | null = null`

`Maybe` matches a token sequence iff its argument matches, or the
token sequence is empty. It is just a syntactic sugar for
`new Or(new Caten(), pattern)`.

### Match, MatchArr
See examples in the section [Match + MatchArr examples](#match--matcharr-examples).

Constructor parameters:
* `prop: [class is Match] ? string | null : string`
* `match: SyntaxTreeClass | Pattern`
* `name: string | null = null`

A `Match` is used to:
0. capture the result of a pattern match into a property of a
   syntax tree node, or
1. use a syntax tree class in the pattern of another syntax tree
   class.

`match` is the pattern that will be matched, and stored into
the property `prop` (if not null).

Assuming the input that is being
parsed matches the pattern, the following holds:

0. If `match` is a string, then the property will be assigned a
   token.
1. If `match` is a syntax tree class, then the property will be
   assigned an instance of that class.
2. If `match` is a non-string pattern, then the property will be
   assigned an array of tokens that matched the pattern.

If the `Match` is not matched (eg. if it is inside a `Maybe` or
a non-matching branch of an `Or`), then the property will be
assigned `null`.

A `Match` cannot be used in a way that would potentially lead to
the same property being assigned to more than once. In contrast,
`MatchArr` can be used any number of times, and always captures
an array of what `Match` would capture.

### Repeat
Constructor parameters:
* `pattern: Pattern` the repeating pattern
* `options?: RepeatOptions`

```ts
// RepeatOptions and their default values (pseudo-code):
{
  delimiter: Pattern = new Caten(),
  trailingDelimiter: Pattern | boolean = false,
  lowerBound: number = 0,
  upperBound: number = Infinity,
  name: string | null = null,
}
```

`Repeat` matches token sequences matched by `A B A B ... A`, where
`A` is the repeating pattern, `B` is the delimiter and the number of
occurrences of `A` is within `lowerBound` (inclusive) and `upperBound`
(exclusive).

If a trailing delimiter is provided, additionally matches sequences
matched by `A B A B ... A T`, with the additional  constraint that
the trailing delimiter must follow an `A`. (Ie. a `Repeat` does
not match a sequence matched by just `T` unless `A` can match the
empty sequence.)

Passing true as the trailing delimiter to the constructor
means the trailing delimiter is the same as the delimiter.

### SyntaxTreeNode
`SyntaxTreeNode` is the superclass of all syntax tree nodes. Every
class that extends `SyntaxTreeNode` must have a static `rule`
property of type `Pattern`.

A syntax tree class may have a static boolean property `hidden`.
If true, the class must have a property called `value`. When
another  class uses a `Match` with a hidden class as the pattern,
the hidden class will not be instantiated during parsing, and its
would-be instance will be replaced by the value of its`value`
property.

Example hidden class:
```ts
class Hidden extends SyntaxTreeNode {
  static hidden = true as true;
  
  value: Token<'a' | 'b'>
  
  static rule = new Or(
    new Match('value', 'a'),
    new Match('value', 'b'),
  );
}

class StartingSymbol {
  // Notice `aOrB` is an instance of `Hidden['value']`, not `Hidden`.
  aOrB: Token<'a' | 'b'>;
  
  static rule = new Match('aOrB', Hidden);
}
```

### SyntaxTreeClass
A type of classes that extend `SyntaxTreeNode`.


## The `Parser<Stc extends SyntaxTreeClass` class
Constructor parameters:
* `public stc: Stc` the starting symbol
* `options: ParserOptions`

```ts
// ParserOptions and their default values (pseudo-code):
{
  tokenizer: Tokenizer = Parser.defaultTokenizer,
  serializedParserTable: [opaque] | null = null,
  logLevel: LogLevel = LogLevel.problemsOnly,
}
```

### The `parse` method
Parameters:
* `word: string`

Return type: `InstanceType<Stc> | TokenizationError | ParseError`

The `parse` method takes a string and returns the result of parsing
it. If the string matches the pattern of `Stc`, then the result is
an instance of `Stc`. If the string does not match, `ParseError`
is returned. If the tokenizer returns an instance of
`TokenizationError`, then it is returned.

### The `saveParserTable` method
Parameters:
* `path: string`

Return type: `Promise<void>`

Saves the parser table to the file at `path` as JSON. The file
may then be imported and passed to the `Parser` constructor using
the `serializedParserTable` option.

Unless a parser is initialized with a serialized parser table,
it will have to construct the parser table from scratch. This may
be fine during development of a grammar, or for small grammars,
but for larger grammars, it may be too slow.

```ts
import { Parser } from 'lr-parser-typescript';

import StartingSymbol from './starting-symbol';
import parserTable from './parser-table.json';

// Set to true to recompute the parser table. May be initialized
// eg. from a CLI flag (or just change the code).
const recomputeTable = false as boolean;

const parser = new Parser(StartingSymbol, {
  serializedParserTable: recomputeTable ? null : parserTable,
});

if (recomputeTable) (async () => {
  // Note: if your code is compiled to a different location,
  // you may need to adjust the path.
  await parser.saveParserTable('./parser-table.json');
  
  console.log('Parser table saved.');
})();
```

### The static `defaultTokenizer` property
The default tokenizer. It will turn a string into a sequence of
single-character tokens. See the section
[An example tokenizer](#an-example-tokenizer) for an example of
a more sophisticated tokenizer.


## Reference (everything else)
These are the exported members of the library.

### SrcPosition (class)
Constructor parameters:
* `public line: number`
* `public col: number`
* `public i: number`

All three arguments use [proper indexing] -- ie. from zero.

[proper indexing]: https://www.cs.utexas.edu/users/EWD/transcriptions/EWD08xx/EWD831.html

### Tokenizer (type)
```ts
type Tokenizer =
  (str: string) =>
    Iterator<
      Token<string>,
      Token<null> | TokenizationError,
    >
```

### TokenizationError (class)
Constructor parameters:
* `public at: SrcPosition`

You may extend this class to provide more information about the
error.

### ParseError (class)
Constructor parameters:
* `public token: Token<string | null>`
* `public expected: (string | null)[]`

## Pattern caching
In the background, `lr-parser-typescript` converts patterns into
a formal grammar, and then constructs a parser table for that
grammar.

It is possible (though not recommended) to use the same pattern
in multiple places. `lr-parser-typescript` makes sure such patterns
are only converted into a grammar rule once. This applies to those
patterns that create their own nonterminals -- ie. `Match`, `Maybe`,
`Or` and `Repeat`.

Every pattern of the above classes (but not their subclasses) that
is used at multiple places must be given an explicit name. Those
patterns that are used only once are given implicit names like
`ClassName.Caten[0].Or[1].Match`.

Pattern names are used to print the grammar and the parser table
in a human-readable form, either if the `logLevel` option is set
to `LogLevel.verbose`, or if there is a grammar conflict.

## Debugging grammar conflicts
A basic understanding of LR parsing is required to understand
grammar conflicts and why they happen. When a grammar conflict
occurs, `lr-parser-typescript` will print the grammar and the
parser table generated up to that point, in a human-readable form.

## Circular grammars
Due to the limitations of JavaScript, classes cannot be referenced
before they are defined. This means we need to be a bit careful
when defining circular grammars.

```ts
// A good convention is `match[propName][className]`.
const matchBarBar = new Match('bar', null!);

class Foo extends SyntaxTreeNode {
  bar!: Bar | null;
  
  static rule = new Caten(
    'foo',
    new Maybe(
      matchBarBar,
    ),
  );
}

class Bar extends SyntaxTreeNode {
  foo!: Foo | null;
  
  static rule = new Caten(
    'bar',
    new Maybe(
      new Match('foo', Foo),
    ),
  );
}

// This is safe as long as it happens before we instantiate the
// parser.
matchBarBar.match = Bar;
```

## Other examples
#### Match + MatchArr examples

```ts
class A extends SyntaxTreeNode {
  asdf!: Token<'identifier'>;

   // We're matching a token, because the second argument is a string.
   static rule = new Match('asdf', 'identifier');
}
```

```ts
class B extends SyntaxTreeNode {
  asdf!: Token<'a' | 'b'>[];
  
  static rule = new Match(
    'asdf',
    // We're matching a token array, because the second argument
    // is a non-string pattern.
    new Caten('a', 'b'),
  );
}
```

```ts
class C extends SyntaxTreeNode {
  childNode!: A;
  
  // We're matching a syntax tree node, because the second argument
  // is a syntax tree class.
  static rule = new Match('childNode', A);
}
```

```ts
class D extends SyntaxTreeNode {
  // We're matching a syntax tree node, but we're not storing it
  // anywhere.
  static rule = new Match(null, A);
}
```

Multiple Match patterns:
```ts
class Bad extends SyntaxTreeNode {
  prop!: Token<'a' | 'b'>;

  // Error: multiple matches for "prop".
  static rule = new Caten(
    new Match('prop', 'a'),
    new Match('prop', 'b'),
  );
}

class Good extends SyntaxTreeNode {
  prop!: Token<'a' | 'b'> | null;

  // OK. Only one of the matches will be used.
  static rule = new Or(
    new Match('prop', 'a'),
    new Match('prop', 'b'),
    'c', // If the input is "c", then prop will be null.
  );
}
```
### An example tokenizer
This tokenizer returns two kinds of tokens: `Token<'word'>` and
`Token<'number'>`. It skips whitespace.

```ts
class WordToken extends Token<'word'> {
  constructor(
    public word: string,
    start: SrcPosition,
    end: SrcPosition,
  ) {
    super('word', start, end);
  }
}

class NumberToken extends Token<'number'> {
  constructor(
    public number: string,
    start: SrcPosition,
    end: SrcPosition,
  ) {
    super('number', start, end);
  }
}

const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const digits = '0123456789';

const handleWhitespace = (str: string, position: SrcPosition) => {
  if (str[position.i] === '\n') {
    position.line++;
    position.col = 0;
    position.i++;
    
    return true;
  }
  
  if (str[position.i] === ' ') {
    position.col++;
    position.i++;
    
    return true;
  }
  
  return false;
};

const handleCharClass =
  <T>(
    charClass: string,
    noFollow: string,
    TokenClass: new (...args: any[]) => T,
  ) =>
  (str: string, position: SrcPosition) =>
{
  let j = position.i;
  
  while (charClass.includes(str[j])) {
    j++;
  }
  
  if (position.i === j) return null;
  
  if (noFollow.includes(str[j])) {
    return new TokenizationError(
      new SrcPosition(position.line, position.col, j),
    );
  }
  
  const token = new TokenClass(
    str.slice(position.i, j),
    new SrcPosition(position.line, position.col, position.i),
    new SrcPosition(position.line, position.col + j - position.i, j),
  );
  
  position.col += j - position.i;
  position.i = j;
  
  return token;
};

const handleWord = handleCharClass(letters, digits, WordToken);
const handleNumber = handleCharClass(digits, letters, NumberToken);

function *tokenizeWordsAndNumbers(str: string) {
  const position = new SrcPosition(0, 0, 0);
  
  while (position.i < str.length) {
    if (handleWhitespace(str, position)) continue;
    
    const word = handleWord(str, position);
    
    if (word) {
      yield word;
      continue;
    }
    
    const number = handleNumber(str, position);
    
    if (number) {
      yield number;
      continue;
    }
    
    return new TokenizationError(position);
  }
  
  return new Token(
    null,
    new SrcPosition(position.line, position.col, position.i),
    new SrcPosition(position.line, position.col, position.i),
  );
}
```
## References

0. [A practical general method for constructing LR(k) parsers](https://sci-hub.se/https://doi.org/10.1007/BF00290336), David Pager, 1977.