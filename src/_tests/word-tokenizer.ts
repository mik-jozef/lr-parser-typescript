import { SrcPosition, Token } from "../token.js";


const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

const otherTokens = [
  ':=',
];

export function *wordTokenizer(str: string) {
  let line = 0;
  let column = 0;
  let i = 0
  
  mainLoop: while (i < str.length) {
    if (str[i] === '\n') {
      line++;
      column = 0;
      i++;
      continue;
    }
    
    if (str[i] === ' ') {
      column++;
      i++;
      continue;
    }
    
    if (letters.includes(str[i])) {
      let j = i + 1;
      
      while (letters.includes(str[j])) {
        j++;
      }
      
      yield new Token(
        str.slice(i, j),
        new SrcPosition(line, column, i),
        new SrcPosition(line, column + j - i, j),
      );
      
      column += j - i;
      i = j;
      continue;
    }
    
    for (const otherToken of otherTokens) {
      if (str.slice(i, i + otherToken.length) === otherToken) {
        yield new Token(
          otherToken,
          new SrcPosition(line, column, i),
          new SrcPosition(line, column + otherToken.length, i + otherToken.length),
        );
        
        column += otherToken.length;
        i += otherToken.length;
        
        continue mainLoop;
      }
    }
    
    yield new Token(
      str[i],
      new SrcPosition(line, column, i),
      new SrcPosition(line, column + 1, i + 1),
    );
    
    column++;
    i++;
  }
  
  return new Token(null, new SrcPosition(line, column, i), new SrcPosition(line, column, i));
}
