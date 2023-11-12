# An introduction tutorial for `lr-parser-typescript`

So you wanna parse strings? Here's the "hello world" of how to do
that with `lr-parser-typescript`!

```ts
import { Caten, Parser, SyntaxTreeNode } from 'lr-parser-typescript';

class StartingSymbol extends SyntaxTreeNode {
  static pattern = new Caten('H', 'e', 'l', 'l', 'o', '!');
}

const parser = new Parser(StartingSymbol);

// An instance of StartingSymbol.
const result = parser.parse('Hello!');
```

As you've certainly noticed, we're using only single letter tokens for
now. We'll fix that later.

The important things to notice are:
* Our grammar is defined by classes that extend `SyntaxTreeNode`.
* Every syntax tree class must have a static property `pattern` that
  defines what strings it can parse.
* We pass the starting symbol to the `Parser` constructor. Then
  we can happily parse strings with `parser.parse`.
* The result of `parser.parse` is an instance of the starting symbol
  class.

## More complex grammars
To parse more complex grammars, we need more complex patterns.
A value of type `Pattern` is either a string or an instance of
several classes. You can find all of them in the package's README,
but here's a quick overview:

* `Caten` concatenates several patterns.
* `Or` matches one of several patterns.
* `Maybe` matches a pattern zero or one time.
* `Repeat` matches a pattern multiple times.
* `Match` allows us to save the matched subpattern as a property of
  the syntax tree node.
* `MatchArr` is like `Match`, but it saves the matched subpattern
  into an array, and can be used multiple times.

Let's pretend the letter "C" stands for any alphanumeric character
(we'll learn about proper tokenization later). With the above
patterns, we can parse a simple email address:

```ts
class EmailAddress extends SyntaxTreeNode {
  localPart!: Token<'C'>[];
  domain!: Token<'C' | '.'>[];
  
  static pattern = new Caten(
    new Match(
      'localPart',
      new Repeat('C', { lowerBound: 1 }),
    ),
    '@',
    new Match(
      'domain',
      new Repeat(new Or('C', '.'), {
        lowerBound: 4,
      }),
    ),
  );
}

const parser = new Parser(EmailAddress);

console.log(parser.parse('CCC@C.CC'));
```

The above code will print:
```
EmailAddress {
  localPart: [
    Token {
      kind: 'C',
      start: SrcPosition { line: 0, col: 0, i: 0 },
      end: SrcPosition { line: 0, col: 1, i: 1 },
    },
    Token { kind: 'C', ... },
    Token { kind: 'C', ... },
  ],
  domain: [
    Token { kind: 'C', ... },
    Token { kind: '.', ... },
    Token { kind: 'C', ... },
    Token { kind: 'C', ... },
  ],
```

The precise value that a Match pattern matches depends on the type
of the pattern's second argument. You can find more information in
the package's README, or in the [examples](./example-match-patterns.md).

## Referring to other syntax tree nodes
For a trivial grammar like the one above, having just one syntax
tree class is enough. But as the grammar grows, we'll want to
split it into several classes.

To do that, we use the `Match` pattern with a syntax tree class
as its second argument. The matched value will be an instance of
that class. (Let's now pretend the letter "i" stands for an
identifier.)

```ts
class FunctionParameter extends SyntaxTreeNode {
  name!: Token<'i'>;
  type!: Token<'i'>;
  
  static pattern = new Caten(
    new Match('name', 'i'),
    ':',
    new Match('type', 'i'),
  );
}

class FunctionDeclaration extends SyntaxTreeNode {
  name!: Token<'i'>;
  parameters!: FunctionParameter[];
  returnType!: Token<'i'>;
  
  static pattern = new Caten(
    'f',
    'n',
    new Match('name', 'i'),
    '(',
    new Repeat(
      new MatchArr('parameters', FunctionParameter),
      {
        delimiter: ',',
        trailingDelimiter: true,
      },
    ),
    ')',
    ':',
    new Match('returnType', 'i'),
    ';',
  );
}

const parser = new Parser(FunctionDeclaration);

console.log(parser.parse('fn i(i: i): i;'));
```

The above code will print:
```
FunctionDeclaration {
  name: Token {
    kind: 'i',
    start: SrcPosition { line: 0, col: 3, i: 3 },
    end: SrcPosition { line: 0, col: 4, i: 4 },
  },
  parameters: [
    FunctionParameter {
      name: Token { kind: 'i', ... },
      type: Token { kind: 'i', ... },
    },
  ],
  returnType: Token {
    kind: 'i',
    start: SrcPosition { line: 0, col: 12, i: 12 },
    end: SrcPosition { line: 0, col: 13, i: 13 },
  },
}
```

## Circular grammars and precedence
Here is a larger example for parsing arithmetic expressions
consisting of numbers, addition, and multiplication. It also
illustrates how one may implement operator precedence. Feel free
to skim this one over, and come back later if you need it.

We'll use the character "N" to stand for any number. Beware, the
example does not yet work as is!

```ts
// Parses either a number or an expression in parentheses.
class BottomRung extends SyntaxTreeNode {
  value!: Token<'N'> | ExprLadder;
  
  static pattern = new Or(
    new Match('value', 'N'),
    new Caten(
      '(',
      new Match('value', ExprLadder),
      ')',
    ),
  );
}

// Parses a multiplication or whatever with lower precedence.
class MulRung extends SyntaxTreeNode {
  value!: Mul | BottomRung;
  
  static pattern = new Or(
    new Match('value', Mul),
    new Match('value', BottomRung),
  );
}

// Parses an addition or whatever with lower precedence.
class ExprLadder extends SyntaxTreeNode {
  value!: Add | MulRung;
  
  static pattern = new Or(
    new Match('value', Add),
    new Match('value', MulRung),
  );
}

class Mul extends SyntaxTreeNode {
  left!: MulRung; // Mul is left-associative.
  right!: BottomRung;
  
  static pattern = new Caten(
    new Match('left', MulRung),
    '*',
    new Match('right', BottomRung),
  );
}

class Add extends SyntaxTreeNode {
  left!: ExprLadder; // Add is left-associative too.
  right!: MulRung;
  
  static pattern = new Caten(
    new Match('left', ExprLadder),
    '+',
    new Match('right', MulRung),
  );
}

const parser = new Parser(ExprLadder);
```

Unfortunately for us, running the above code results in an ugly
error:

```
file:///example.mjs:9
      new Match('value', ExprLadder),
                          ^

ReferenceError: Cannot access 'ExprLadder' before initialization
```

The problem is we're using `ExprLadder` in `BottomRung`'s pattern,
but we're defining `ExprLadder` only later. Since `ExprLadder` uses
`MulRung`, and `MulRung` uses `BottomRung`, we have a circular
dependency, so we cannot solve the problem by reordering the classes.

The solution is to temporarily use null instead of any class that
will only be defined later, and then replace the nulls with the
classes once they are defined.

```diff
+ const matchValueExprLadder = new Match('value', null!);
+ 
+ const matchValueMul = new Match('value', null!);
+ const matchValueAdd = new Match('value', null!);
+ 
// Parses either a number or an expression in parentheses.
class BottomRung extends SyntaxTreeNode {
. . . . . . . . . . . . . . . . . . . .
    new Caten(
      '(',
+       matchValueExprLadder,
-       new Match('value', ExprLadder),
      ')',
    ),
. . . . . . . . . . . . . . . . . . . .
  
  static pattern = new Or(
+     matchValueMul,
-     new Match('value', Mul),
    new Match('value', BottomRung),
  );
. . . . . . . . . . . . . . . . . . . .
  
  static pattern = new Or(
+     matchValueAdd,
-     new Match('value', Add),
    new Match('value', MulRung),
  );
. . . . . . . . . . . . . . . . . . . .
  );
}
+ 
+ // This is fine as long as it happens before we instantiate the
+ // parser.
+ matchValueExprLadder.pattern = ExprLadder;
+ 
+ matchValueMul.pattern = Mul;
+ matchValueAdd.pattern = Add;

const parser = new Parser(ExprLadder);
```

Now our example works, but there is a final inconvenience to be
fixed. The above grammar will parse `N` as

```
ExprLadder {
  value: MulRung {
    value: BottomRung {
      value: Token {
        kind: 'N',
        start: SrcPosition { line: 0, col: 0, i: 0 },
        end: SrcPosition { line: 0, col: 1, i: 1 },
      },
    },
  },
}
```

The crux of the problem is that the ladder is there just to define
the precedence of the operators, but we don't actually want it in
the syntax tree. Fortunately for us, we can hide classes like these
by adding a static property `hidden = true` to them. A hidden class
will be replaced by its property `value` in the syntax tree.

```diff
class BottomRung extends SyntaxTreeNode {
+   static hidden = true as true;
+   
  value!: Token<'N'> | ExprLadder;
  
. . . . . . . . . . . . . . . . . . . .
// And similarly for MulRung and ExprLadder.
```

This results in a clean syntax tree with just numbers, additions,
and multiplications.

## Tokenization
So far we've only used single letter tokens, because we've been
relying on the default tokenizer, which treats every character
as a separate token.

In real-world grammars, we want to have many-character tokens,
like identifiers, numbers, and strings. We also want to ignore
whitespace and comments.

To do these things, we need to define a custom tokenizer. There
is a [separate page describing how](./example-tokenizer.md).