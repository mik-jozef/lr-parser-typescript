import { Grammar, grammarSymbolToString } from "../../grammar.js";
import { Match, Pattern, PatternGrammar, SyntaxTreeClass } from "#pattern";
import { RuleAt } from "./rule-at.js";
import { computeZeroth } from "./zeroth.js";
import { GrammarConflict, ParserState } from "./parser-state.js";
import { ParserTable } from "./parser-table.js";

const printTable = (
  table: ParserTable,
  grammar: PatternGrammar,
  maybeConflict: GrammarConflict | null,
) => {
  let str = 'Grammar rules:\n';
  
  grammar.rules.forEach(rule => {
    str += `${rule.toString(grammar.nonterminalNames)}\n`
  });
  
  str += '\n';
  str += 'Parser states:\n';
  
  table.states.forEach(state => {
    str += `${state.toString(grammar)}\n`;
  })
  
  if (maybeConflict) {
    str += `ERROR: Grammar conflict found while generating the state ${maybeConflict.state.index}.\n`;
    
    const actionType = maybeConflict.conflictingAction instanceof ParserState
      ? 'a transition to state'
      : 'a reduction by rule'
    ;
    
    str += `Tried to add ${actionType} ${maybeConflict.conflictingAction.index} `;
    str += `under the symbol ${grammarSymbolToString(grammar.nonterminalNames, maybeConflict.under)}.\n\n`
  }
  
  str += `Grammar size: ${grammar.rules.length}\n`;
  str += `Parser size: ${table.states.length}`;
  
  console.log(str);
  
  if (maybeConflict) throw new Error('Grammar conflict. Check console logs for details.');
}

export enum LogLevel {
  none = 'none',
  problemsOnly = 'problemsOnly',
  verbose = 'verbose',
}

export const generateTable = (
  stc: SyntaxTreeClass,
  logLevel: LogLevel,
) => {
  const grammar = new Grammar<Pattern | SyntaxTreeClass, SyntaxTreeClass>();
  const rootMatch = new Match('root', stc);
  const rule = rootMatch.toGrammarRule(grammar, '(starting symbol)', Grammar.startingSymbol);
  const ruleAt = new RuleAt(rule, 0, new Set([ null ]));
  
  computeZeroth(grammar);
  
  const table = new ParserTable(grammar, logLevel === LogLevel.verbose);
  const initialState = new ParserState([ ruleAt ]);
  
  table.insert(initialState);
  
  const maybeConflict = table.generateStates();
  
  if (logLevel === LogLevel.verbose || maybeConflict) {
    printTable(table, grammar, maybeConflict);
  }
  
  return table;
}