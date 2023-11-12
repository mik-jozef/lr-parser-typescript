# Example Match and MatchArr patterns

## Types of matched values

```ts
class A extends SyntaxTreeNode {
  asdf!: Token<'identifier'>;
  
  // We're matching a token, because the second argument is a string.
  static pattern = new Match('asdf', 'identifier');
}
```

```ts
class B extends SyntaxTreeNode {
  asdf!: Token<'a' | 'b'>[];
  
  static pattern = new Match(
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
  static pattern = new Match('childNode', A);
}
```

```ts
class D extends SyntaxTreeNode {
  // We're matching a syntax tree node, but we're not storing it
  // anywhere.
  static pattern = new Match(null, A);
}
```

## Multiple Match patterns

```ts
class Bad extends SyntaxTreeNode {
  prop!: Token<'a' | 'b'>;

  // Error: multiple consecutive matches for "prop".
  static pattern = new Caten(
    new Match('prop', 'a'),
    new Match('prop', 'b'),
  );
}

class Good extends SyntaxTreeNode {
  prop!: Token<'a' | 'b'> | null;

  // OK. Only one of the matches will be used.
  static pattern = new Or(
    new Match('prop', 'a'),
    new Match('prop', 'b'),
    'c', // If the input is "c", then prop will be null.
  );
}
```

## MatchArr patterns

```ts
class A extends SyntaxTreeNode {
  asdf!: Token<'identifier'>[];
  
  // We're matching a token array (even though it will ever only
  // have one element).
  static pattern = new MatchArr('asdf', 'identifier');
}
```

```ts
class B extends SyntaxTreeNode {
  // An array of two elements.
  asdf!: [ [ Token<'a'>, Token<'b'> ], Token<'c'> ];
  
  static pattern = new Caten(
    new MatchArr('asdf', new Caten('a', 'b')),
    new MatchArr('asdf', 'c'),
  );
}
```

```ts
class C extends SyntaxTreeNode {
  elements!: A[];
  
  // We're matching an array of syntax tree nodes.
  static pattern = new Repeat(
    new MatchArr('elements', A),
    { delimiter: ',' },
  );
}
```

```ts
class Bad extends SyntaxTreeNode {
  // This is not allowed. Use a Match instead.
  static pattern = new MatchArr(null, A);
}
```

## Match and MatchArr patterns cannot be mixed

This will throw an error when instantiating the parser.

```ts
class Bad extends SyntaxTreeNode {
  prop!: Token<'a'> | Token<'b'>[];
  
  // This is not allowed. Either use a MatchArr for both, or create
  // two separate properties.
  static pattern = new Or(
    new Match('asdf', 'a'),
    new MatchArr('asdf', 'b'),
  );
}
```