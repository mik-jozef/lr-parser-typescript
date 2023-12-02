import { Match, MatchArr, SyntaxTreeNode } from "#pattern";
import { Parser } from "../parser/parser.js";
import { SrcPosition, Token } from "../token";
import { Parent, parser } from "./grammar-7.js";
import { safeCast } from "./utils";

describe('Parser', () => {
  it('throws if a hidden array class is used with Match', () => {
    class A extends SyntaxTreeNode {
      static hidden = true as true;
      
      static pattern = new MatchArr('value', 'a');
    }
    
    class B extends SyntaxTreeNode {
      static pattern = new Match('a', A);
    }
    
    expect(() => new Parser(B)).toThrow('A hidden array-capturing class must be captured using "MatchArr".');
  });
  
  it('parses hidden classes correctly', () => {
    const result = parser.parse('ccaade');
    
    const parent = safeCast(result, Parent);
    
    expect(parent.child).toStrictEqual(
      new Token('c', new SrcPosition(0, 0, 0), new SrcPosition(0, 1, 1)),
    );
    
    expect(parent.childArr).toStrictEqual([
      new Token('c', new SrcPosition(0, 1, 1), new SrcPosition(0, 2, 2)),
    ]);
    
    expect(parent.arrChildren).toStrictEqual([
      new Token('a', new SrcPosition(0, 2, 2), new SrcPosition(0, 3, 3)),
      new Token('a', new SrcPosition(0, 3, 3), new SrcPosition(0, 4, 4)),
      new Token('d', new SrcPosition(0, 4, 4), new SrcPosition(0, 5, 5)),
      [ new Token('e', new SrcPosition(0, 5, 5), new SrcPosition(0, 6, 6)) ],
    ]);
  });
});
