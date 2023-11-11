import { Parser } from "../parser/parser.js";
import { Match, SyntaxTreeNode } from "#pattern";
import { LogLevel } from "../parser/table/generate-table.js";
import { Token } from "../token";

class Hidden extends SyntaxTreeNode {
  static hidden = true as true;
  
  value!: Token<'a'>;
  
  static rule = new Match('value', 'a');
}

export const parser = new Parser(Hidden, {
  logLevel: LogLevel.none,
});
