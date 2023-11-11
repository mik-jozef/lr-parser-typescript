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
  
  expect((fs.writeFile as jest.Mock).mock.calls[0]).toMatchInlineSnapshot(`
[
  "path-is-ignored-in-the-mocked-function",
  "{"states":[{"isAccepting":false,"transitions":[{"under":"a","action":{"read":true,"index":1}},{"under":2,"action":{"read":true,"index":2}},{"under":1,"action":{"read":true,"index":3}}]},{"isAccepting":false,"transitions":[{"under":"b","action":{"read":true,"index":4}},{"under":4,"action":{"read":true,"index":5}},{"under":3,"action":{"read":true,"index":6}}]},{"isAccepting":false,"transitions":[{"under":null,"action":{"read":false,"index":5}}]},{"isAccepting":true,"transitions":[{"under":null,"action":{"read":false,"index":6}}]},{"isAccepting":false,"transitions":[{"under":"c","action":{"read":false,"index":0}}]},{"isAccepting":false,"transitions":[{"under":"c","action":{"read":false,"index":1}}]},{"isAccepting":false,"transitions":[{"under":"c","action":{"read":true,"index":7}},{"under":6,"action":{"read":true,"index":8}},{"under":5,"action":{"read":true,"index":9}}]},{"isAccepting":false,"transitions":[{"under":"d","action":{"read":false,"index":2}}]},{"isAccepting":false,"transitions":[{"under":"d","action":{"read":false,"index":3}}]},{"isAccepting":false,"transitions":[{"under":"d","action":{"read":true,"index":10}}]},{"isAccepting":false,"transitions":[{"under":null,"action":{"read":false,"index":4}}]}],"reduceInfos":{"0":{"popCount":1,"reduceInto":4,"prop":null},"1":{"popCount":1,"reduceInto":3,"prop":null},"2":{"popCount":1,"reduceInto":6,"prop":null},"3":{"popCount":1,"reduceInto":5,"prop":"c","isArrayMatch":false,"type":["class","C"]},"4":{"popCount":4,"reduceInto":2,"prop":null},"5":{"popCount":1,"reduceInto":1,"prop":"root","isArrayMatch":false,"type":["class","StartingSymbol"]},"6":{"popCount":1,"reduceInto":0,"prop":null}}}",
]
`);
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