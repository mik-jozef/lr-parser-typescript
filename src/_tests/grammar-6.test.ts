import { LetDeclaration, parser } from "./grammar-6.js";
import { ParseError } from "../parser/parser.js";

describe('Parser', () => {
  it('does not parse ""', () => {
    const result = parser.parse('');
    
    expect(result).toBeInstanceOf(ParseError);
  });
  
  it('does not parse "l"', () => {
    const result = parser.parse('l');
    
    expect(result).toBeInstanceOf(ParseError);
  });
  
  it('parses "l{}"', () => {
    const result = parser.parse('l{}');
    
    expect(result).toBeInstanceOf(LetDeclaration);
    expect(result as LetDeclaration).toHaveProperty('body', []);
  });
  
  it('parses "l{l{}}"', () => {
    const result = parser.parse('l{l{}}');
    
    expect(result).toBeInstanceOf(LetDeclaration);
    expect(result as LetDeclaration).toHaveProperty('body', [
      expect.any(LetDeclaration),
    ]);
  });
});
