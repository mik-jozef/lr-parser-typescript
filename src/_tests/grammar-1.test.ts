import { ParseError } from "../parser/parser.js";
import { C, parser, StartingSymbol } from "./grammar-1.js";
import { SrcPosition, Token } from "../token.js";

describe('Parser', () => {
  it('parses a word of a larger grammar', () => {
    const resultAbd = parser.parse('abd');
    
    expect(resultAbd).toBeInstanceOf(StartingSymbol);
    expect((resultAbd as StartingSymbol).c).toBeNull();
    
    const resultAcd = parser.parse('acd');
    
    expect(resultAcd).toBeInstanceOf(StartingSymbol);
    expect((resultAcd as StartingSymbol).c).toBeInstanceOf(C);
    
    const resultAdd = parser.parse('add');
    
    expect(resultAdd).toBeInstanceOf(StartingSymbol);
    expect((resultAdd as StartingSymbol).c).toBeNull();
  });
  
  it('returns a ParseError when the input is invalid (end of input)', () => {
    const result = parser.parse('ab');
    
    expect(result).toBeInstanceOf(ParseError);
    expect((result as ParseError).token).toEqual({
      kind: null,
      start: new SrcPosition(0, 2, 2),
      end: new SrcPosition(0, 2, 2),
    });
  });
  
  it('returns a ParseError when the input is invalid (unexpected token)', () => {
    const resultAf = parser.parse('af');
    
    expect(resultAf).toBeInstanceOf(ParseError);
    expect((resultAf as ParseError).token).toEqual(
      new Token(
        'f',
        new SrcPosition(0, 1, 1),
        new SrcPosition(0, 2, 2),
      ),
    );
    
    const resultAbbd = parser.parse('abbd');
    
    expect(resultAbbd).toBeInstanceOf(ParseError);
    expect((resultAbbd as ParseError).token).toEqual({
      kind: 'b',
      start: new SrcPosition(0, 2, 2),
      end: new SrcPosition(0, 3, 3),
    });
  });
});