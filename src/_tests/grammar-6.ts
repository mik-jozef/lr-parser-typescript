import { Caten, Maybe, MatchArr, SyntaxTreeNode } from "#pattern";
import { LogLevel } from "../parser/table/generate-table.js";
import { Parser } from "../parser/parser.js";


export class LetDeclaration extends SyntaxTreeNode {
  body!: LetDeclaration[];
  
  static pattern: Caten = new Caten(
    'l',
    '{',
    new Maybe(
      new MatchArr('body', LetDeclaration),
    ),
    '}',
  );
}

export const parser = new Parser(LetDeclaration, {
  logLevel: LogLevel.none,
});

parser.parse('l{l{}}');
