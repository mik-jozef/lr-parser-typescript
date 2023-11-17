import { promises as fs } from 'fs';

import { ParseError, Parser } from "../parser/parser.js";
import { C, parser, StartingSymbol } from "./grammar-0.js";
import { SrcPosition, Token } from "../token.js";

let parserWithCachedTable!: Parser<typeof StartingSymbol>;

fs.writeFile = jest.fn().mockImplementation((_path: string, data: string) => {
  parserWithCachedTable = new Parser(StartingSymbol, {
    serializedParserTable: JSON.parse(data),
  });
});

it('saves the table', () => {
  parser.saveParserTable('path-is-ignored-in-the-mocked-function');
  
  expect(fs.writeFile as jest.Mock).toHaveBeenCalledWith(
    'path-is-ignored-in-the-mocked-function',
    expect.objectContaining({}),
  );
});

const parsers: [ string, () => Parser<typeof StartingSymbol> ][] = [
  [ 'with a computed table', () => parser ],
  [ 'with a cached table', () => parserWithCachedTable ],
];

describe.each(parsers)('Parser %s', (_description, parser) => {
  it('parses a word of a simple grammar', () => {
    const result = parser().parse('abcd');
    
    expect(result).toBeInstanceOf(StartingSymbol);
    expect((result as StartingSymbol).c).toBeInstanceOf(C);
  });
  
  it('returns a ParseError when the input is invalid (end of input)', () => {
    const result = parser().parse('ab');
    
    expect(result).toBeInstanceOf(ParseError);
    expect((result as ParseError).token).toEqual({
      kind: null,
      start: new SrcPosition(0, 2, 2),
      end: new SrcPosition(0, 2, 2),
    });
  });
  
  it('returns a ParseError when the input is invalid (unexpected token)', () => {
    const resultAbcde = parser().parse('abcde');
    
    expect(resultAbcde).toBeInstanceOf(ParseError);
    expect((resultAbcde as ParseError).token).toEqual(
      new Token(
        'e',
        new SrcPosition(0, 4, 4),
        new SrcPosition(0, 5, 5),
      ),
    );
    
    const resultAbbd = parser().parse('abbd');
    
    expect(resultAbbd).toBeInstanceOf(ParseError);
    expect((resultAbbd as ParseError).token).toEqual({
      kind: 'b',
      start: new SrcPosition(0, 2, 2),
      end: new SrcPosition(0, 3, 3),
    });
  });
});