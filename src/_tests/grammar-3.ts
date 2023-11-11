import { Parser } from "../parser/parser.js";
import { Caten, Match, Or, SyntaxTreeNode } from "#pattern";
import { LogLevel } from "../parser/table/generate-table.js";
import { Token } from "../token.js";
import { wordTokenizer } from "./word-tokenizer.js";


class UnionRung extends SyntaxTreeNode {
  static hidden = true;
  
  static rule = new Match('value', 'number');
}

class BecomesRung extends SyntaxTreeNode {
  static hidden = true;
  
  static rule = new Or(
    new Match('value', UnionRung),
  );
}

class Assignment extends SyntaxTreeNode {
  left!: Token<'number'>;
  
  static rule: Caten = new Caten(
    new Match('left', UnionRung),
    '<<',
  );
}

export class ExprRung extends SyntaxTreeNode {
  static rule: Or = new Or(
    new Match('value', Assignment),
    new Match('value', BecomesRung),
  );
}

export const parser = new Parser(ExprRung, {
  logLevel: LogLevel.none,
  tokenizer: wordTokenizer,
});

parser.parse('number');
