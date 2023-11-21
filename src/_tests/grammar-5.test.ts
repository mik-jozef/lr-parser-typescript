import { ExprRung, parser } from "./grammar-5.js";
import { ParseError } from "../parser/parser";

describe('Parser', () => {
  it('does not parse "a"', () => {
    const result = parser.parse('a');
    
    expect(result).toBeInstanceOf(ParseError);
  });
  
  it('parses "i(i)"', () => {
    const result = parser.parse('i(i)');
    
    expect(result).toBeInstanceOf(ExprRung);
  });
});
