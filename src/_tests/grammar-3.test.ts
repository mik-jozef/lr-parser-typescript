import { parser, ExprRung } from "./grammar-3";

describe('Parser', () => {
  it('parses "number"', () => {
    const result = parser.parse('number');
    
    expect(result).toBeInstanceOf(ExprRung);
  });
});