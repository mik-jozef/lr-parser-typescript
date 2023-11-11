import { Parser } from "../parser/parser.js";
import { Caten, Match, SyntaxTreeNode } from "#pattern";
import { LogLevel } from "../parser/table/generate-table.js";

export class B extends SyntaxTreeNode {
  static rule = 'b';
}

export class C extends SyntaxTreeNode {
  static rule = 'c';
}

export class StartingSymbol extends SyntaxTreeNode {
  c!: C;
  
  static rule = new Caten(
    'a',
    new Match(null, B),
    new Match('c', C),
    'd'
  );
}

export const parser = new Parser(StartingSymbol, {
  logLevel: LogLevel.none,
});
