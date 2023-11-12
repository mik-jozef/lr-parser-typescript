# An example tokenizer
A tokenizer is anything of type

```ts
(str: string) =>
  Iterator<
    Token<string>,
    Token<null> | TokenizationError
  >
```

In particular, a generator function will work.

```ts
function *tokenizer(str: string) {
  // Yield the tokens here.
}
```

Our example tokenizer returns two kinds of tokens: `Token<'word'>`
and `Token<'number'>`. It skips whitespace.

We zeroth extend `Token` to create `WordToken` and `NumberToken`.
These tokens will store, along with their kind (`'word'` or
`'number'`), the word or number they represent.

```ts
// `tokenizer.ts`
export class WordToken extends Token<'word'> {
  constructor(
    public word: string,
    start: SrcPosition,
    end: SrcPosition,
  ) {
    super('word', start, end);
  }
}

export class NumberToken extends Token<'number'> {
  constructor(
    public number: string,
    start: SrcPosition,
    end: SrcPosition,
  ) {
    super('number', start, end);
  }
}
```

Now we define a few helper functions. These take a string and the
current position, and return what they matched, or a value indicating
whether they had any effect.

`handleWhitespace` updates the position to skip a whitespace
character, returning `true` if it did so.

```ts
// `tokenizer.ts`
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
```

`handleCharClass` is a factory for our helper functions. The function
it returns tries to match the longest possible string of characters
in `charClass`. If that string is empty, returns `null`. Else, if
the next character is in `noFollow`, returns a `TokenizationError`.
Else, the function returns the matched string as a token of type
`TokenClass`.

```ts
// `tokenizer.ts`
const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const digits = '0123456789';

type TokenConstructor<T> = new (
  value: string,
  start: SrcPosition,
  end: SrcPosition,
) => T;

const handleCharClass =
  <T>(
    charClass: string,
    noFollow: string,
    TokenClass: TokenConstructor<T>,
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
```

Lastly, we define our tokenizer using a generator function.

```ts
// `tokenizer.ts`
const handleWord = handleCharClass(letters, digits, WordToken);
const handleNumber = handleCharClass(digits, letters, NumberToken);

export function *tokenizeWordsAndNumbers(str: string) {
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
  
  // The "end of input" token.
  return new Token(
    null,
    new SrcPosition(position.line, position.col, position.i),
    new SrcPosition(position.line, position.col, position.i),
  );
}
```

To use our tokenizer, we just need to pass it to a Parser constructor.

```ts
// `parser.ts`
import { Parser } from 'lr-parser-typescript';

import { StartingSymbol } from './grammar';
import { tokenizeWordsAndNumbers } from './tokenizer';

export const parser = new Parser(StartingSymbol, {
  tokenizer: tokenizeWordsAndNumbers,
});
```

We're done! 🎉 Our grammar can now use 'word' and 'number' tokens.

```ts
// `grammar.ts`
import { Repeat, SyntaxTreeNode } from 'lr-parser-typescript';

export class StartingSymbol extends SyntaxTreeNode {
  static pattern = new Repeat('word', {
    delimiter: 'number',
  });
}
```

```ts
// `index.ts`
import { parser } from './parser';

parser.parse('hello 123 world'); // An instance of StartingSymbol.
```