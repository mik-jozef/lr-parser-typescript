import { ParseError } from "../parser/parser.js";
import { parser, HyloaModuleAst } from "./grammar-2.js";
import { SrcPosition } from "../token.js";

describe('Parser', () => {
  it('parses "import"', () => {
    const result = parser.parse('import');
    
    expect(result).toBeInstanceOf(HyloaModuleAst);
  });
  
  it('parses "let"', () => {
    const result = parser.parse('let');
    
    expect(result).toBeInstanceOf(HyloaModuleAst);
  });
  
  it('parses "import let"', () => {
    const result = parser.parse('import let');
    
    expect(result).toBeInstanceOf(HyloaModuleAst);
  });
  
  it('does not parse "let import"', () => {
    const result = parser.parse('let import');
    
    expect(result).toBeInstanceOf(ParseError);
    expect((result as ParseError).token).toEqual({
      kind: 'import',
      start: new SrcPosition(0, 4, 4),
      end: new SrcPosition(0, 10, 10),
    });
  });
});