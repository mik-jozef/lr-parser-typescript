import { Caten, Match, MatchArr, Or, SyntaxTreeNode } from "#pattern";
import { LogLevel } from "../parser/table/generate-table.js";
import { Parser } from "../parser/parser.js";


const matchValueProcedureCall = new Match('value', null!);
const matchValueExprRung = new Match('value', null!);

export class ExprRung extends SyntaxTreeNode {
  static pattern = new Or(
    matchValueProcedureCall,
    new Match('value', 'i'),
  );
}

// End of the ladder.

export class ProcedureCall extends SyntaxTreeNode {
  static pattern = new Caten(
    'i',
    '(',
    new MatchArr('args', ExprRung),
    ')',
  );
}

matchValueProcedureCall.match = ProcedureCall;
matchValueExprRung.match = ExprRung;

export const parser = new Parser(ExprRung, {
  logLevel: LogLevel.verbose,
});
