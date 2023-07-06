import { Grammar, GrammarSymbol } from './parser.js';
import { Pattern, Match } from './patterns.js';


export const numbers = '0123456789';
export const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const numLet = letters + numbers;

export class TokenKind<TokenString extends string> extends Pattern {
  kind: 'TokenKind' = 'TokenKind';
  
  constructor(
    public token: TokenString,
  ) { super(); }
  
  toGrammarRule(grammar: Grammar, nt?: Match): GrammarSymbol[] {
    if (nt) {
      grammar.insertRule(nt, [ this ]);
      
      return [ nt ];
    }
    
    return [ this ];
  }
  
  getFields(fields: Record<string, boolean> = {}) { return fields; }
}

export class SrcPosition {
  constructor(
    public line: number,
    public col: number,
    public i: number,
  ) {}
}

// TODO merge The zeroth three into one class.
export abstract class Token<TokenString extends string> {
  abstract kind: TokenKind<TokenString>;
  
  constructor(
    public start: SrcPosition,
    public end: SrcPosition,
  ) {}
}

export class BasicToken<TokenString extends string> extends Token<TokenString> {
  constructor(
    start: SrcPosition,
    end: SrcPosition,
    public kind: TokenKind<TokenString>,
  ) { super(start, end); }
}

const specialTokenKinds = {
  identifier: new TokenKind('identifier'),
  number: new TokenKind('number'),
  text: new TokenKind('text'),
};

export class IdentifierToken extends Token<'identifier'> {
  kind = specialTokenKinds.identifier;
  
  constructor(
    start: SrcPosition,
    end: SrcPosition,
    public value: string,
  ) { super(start, end); }
}

export class NumberToken extends Token<'number'> {
  kind = specialTokenKinds.number;
  
  constructor(
    start: SrcPosition,
    end: SrcPosition,
    public value: number,
  ) { super(start, end); }
}

export class TextToken extends Token<'text'> {
  kind = specialTokenKinds.text;
  
  constructor(
    start: SrcPosition,
    end: SrcPosition,
    public value: string,
  ) { super(start, end); }
}

export class TokenizationError {
  constructor(
    public at: SrcPosition,
  ) {}
}

export class Tokenizer<TokenString extends string> {
  tokenKinds: TokenKind<TokenString>[] = [];
  tokensStringsToKinds = new Map<TokenString, TokenKind<TokenString>>();
  
  constructor(
    tokenStrings: readonly TokenString[],
  ) {
    [ 'identifier', 'number', 'text' ].forEach((ts: any) => {
      if (!tokenStrings.includes(ts)) throw new Error('TokenStrings must include "' + ts + '".');
    });
    
    let length = Infinity;
    
    tokenStrings.forEach(tokenString => {
      if (length < tokenString.length) throw new Error('TokenStrings must be ordered by length.');
      
      length = tokenString.length;
      
      const tokenKind = (specialTokenKinds as any)[tokenString] || new TokenKind(tokenString);
      
      this.tokenKinds.push( tokenKind );
      this.tokensStringsToKinds.set( tokenString, tokenKind );
    });
    
    this.token = this.token.bind(this);
  }
  
  token<TS extends TokenString>(str: TS): TokenKind<TS> {
    const tokenKind =
       this.tokensStringsToKinds.get(str) as TokenKind<TS> | undefined;
    
    if (!tokenKind) throw new Error(`Nonexisting token kind: "${str}".`);
    
    return tokenKind;
  }
  
  // Yields / returns `[ TokenKind, position in string, value ]`.
  *tokenize(str: string): Generator<Token<TokenString | keyof typeof specialTokenKinds>, TokenizationError | null> {
    let nowPosition = new SrcPosition(0, 0, 0);
    
    for (let i = 0; i < str.length;) {
      function incrementPosition(n = 1): void {
        if (n === 0) return;
        
        nowPosition = str[i] === '\n'
          ? new SrcPosition(nowPosition.line + 1, 0, i + 1)
          : new SrcPosition(nowPosition.line, nowPosition.col + 1, i + 1);
        
        i += 1;
        
        return incrementPosition(n - 1);
      }
      
      while (i < str.length && [ ' ', '\n' ].includes(str[i])) incrementPosition();
      
      if (i === str.length) return null;
      
      if (str.substring(i).startsWith('///')) {
        incrementPosition(3);
        
        while (i < str.length && !str.substring(i).startsWith('///')) incrementPosition();
        
        if (i === str.length) return new TokenizationError( nowPosition );
        
        incrementPosition(3);
        
        continue;
      }
      
      if (str.substring(i).startsWith('//')) {
        while (i < str.length && '\n' !== str[i]) incrementPosition();
        
        continue;
      }
      
      const startI = i;
      const startPosition = new SrcPosition(nowPosition.line, nowPosition.col, i);
      
      const tokenKind = this.tokenKinds.find(tokenKind => str.substring(i).startsWith(tokenKind.token));
      
      if (tokenKind) {
        incrementPosition(tokenKind.token.length);
        
        const tokenEnd = i;
        
        if (tokenKind.token.match(/^\w+$/)) {
          while (i < str.length && numLet.includes(str[i])) incrementPosition();
        }
        
        yield tokenEnd < i || (tokenKind.token.match(/^\w+$/) && 1 <= startI && str[ startI - 1 ] === '.')
          ? new IdentifierToken(startPosition, nowPosition, str.substring(startI, i))
          : new BasicToken(startPosition, nowPosition, tokenKind);
        
        continue;
      }
      
      if (str[i] === '"') {
        let isEscaped = false;
        let value = '';
        
        incrementPosition();
        
        while (i < str.length) {
          if (isEscaped) {
            const c = [ '\\', '"', 'n' ].find(c => c === str[i]);
            
            if (!c) return new TokenizationError( nowPosition );
            
            value += c === 'n' ? '\n' : c;
            
            incrementPosition();
            isEscaped = false;
          } else {
            if (str[i] === '"') {
              incrementPosition();
              
              break;
            }
            
            if (str[i] === '\\') {
              isEscaped = true;
            } else {
              value += str[i];
            }
            
            incrementPosition();
          }
        }
        
        yield new TextToken(startPosition, nowPosition, value);
        
        continue;
      }
      
      if (numbers.includes(str[i])) {
        let dot = false;
        
        const isDot = () => str[i] === '.' && (dot = true);
        
        while (i < str.length && (numbers.includes(str[i]) || !dot && isDot())) incrementPosition();
        
        if (str[ i - 1 ] === '.') return new TokenizationError( nowPosition );
        
        const parse = dot ? Number.parseFloat : Number.parseInt;
        
        yield new NumberToken(startPosition, nowPosition, parse(str.substring(startI, i)));
        
        continue;
      }
      
      if (letters.includes(str[i])) {
        while (i < str.length && numLet.includes(str[i])) incrementPosition();
        
        yield new IdentifierToken(startPosition, nowPosition, str.substring(startI, i));
        
        continue;
      }
      
      return new TokenizationError( nowPosition );
    }
    
    return null;
  }
}
