/*/
  The parser table in `./parser-table.ts` is used to generate
  a parser table from a grammar. It contains more info than
  that is required for just parsing. This file contains a
  reduced version of the parser table that is used by the parser.
/*/

import { GrammarSymbol, MatchType } from "../../grammar.js";
import { SyntaxTreeClass } from "#pattern";


export class ReduceNonmatchAction {
  prop: null = null;
  
  constructor(
    // The number of symbols to pop off the stack.
    public popCount: number,
    // The nonterminal to reduce into, ie. the head of the rule to reduce by.
    public reduceInto: number,
  ) {}
}

export class ReduceMatchAction {
  constructor(
    public popCount: number,
    public reduceInto: number,
    public prop: string,
    public isArrayMatch: boolean,
    public match: SyntaxTreeClass | MatchType,
  ) {}
}

export type ReduceAction = ReduceNonmatchAction | ReduceMatchAction;
export type Action = ReducedParserState | ReduceAction;

export class ReducedParserState {
  actions = new Map<GrammarSymbol | null, Action>();
  
  constructor(
    public isAccepting: boolean,
  ) {}
}
