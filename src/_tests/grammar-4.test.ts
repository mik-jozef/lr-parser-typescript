import { parser } from "./grammar-4";
import { Token } from "../token";

describe('Parser', () => {
  it('parses "a" and respects hiddenness', () => {
    const result = parser.parse('a');
    
    expect(result).toBeInstanceOf(Token);
    expect((result as Token<string>).kind).toBe('a');
  });
});
