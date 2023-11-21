import {
  Constructor,
  Context,
  Grammar,
  GrammarRule,
  GrammarSymbol,
  grammarSymbolToString,
  Nonterminal
} from "../../grammar.js";
import { getZerothOfSequence } from "./zeroth.js";

export class RuleAt {
  at(): GrammarSymbol | null {
    return this.rule.expansion[this.dot] || null;
  };
  
  constructor(
    public rule: GrammarRule,
    public dot: number,
    public follow: Context,
  ) {}
  
  toString(nonterminalNames: Map<Nonterminal, string>) {
    const head = grammarSymbolToString(nonterminalNames, this.rule.head);
    
    const expansion0 = this.rule.expansion
      .slice(0, this.dot)
      .map((symbol) => grammarSymbolToString(nonterminalNames, symbol))
      .join(' ');
    
    const expansion1 = this.rule.expansion
      .slice(this.dot)
      .map((symbol) => grammarSymbolToString(nonterminalNames, symbol))
      .join(' ');
    
    const follow = this.follow.size === 0
      ? '∅'
      : `{ ${[ ...this.follow ].map(c => c === null ? '(end of input)' : `"${c}"`).join(', ')} }`;
    
    return `${head} -> ${expansion0} . ${expansion1}   ${follow}`;
  }
  
  followAt<T0, T1 extends Constructor>(grammar: Grammar<T0, T1>) {
    return getZerothOfSequence(
      grammar.zerothSets,
      this.rule.expansion,
      this.follow,
      this.dot + 1,
    );
  }
  
  shift(): RuleAt {
    if (this.at() === null) throw new Error('at null');
    
    return new RuleAt(this.rule, this.dot + 1, new Set(this.follow));
  }
  
  // TODO delete?
  static equals(a: RuleAt, b: RuleAt): boolean {
    return a.rule === b.rule
      && a.dot === b.dot
      && a.follow.size === b.follow.size
      && [ ...a.follow ].every(e => b.follow.has(e))
      ;
  }
  
  static isIsocore(a: RuleAt, b: RuleAt): boolean {
    return a.rule === b.rule
      && a.dot === b.dot
      ;
  }
  
  static compare(a: RuleAt, b: RuleAt): number {
    const ruleDiff = a.rule.index - b.rule.index;
    
    return ruleDiff !== 0 ? ruleDiff : b.dot - a.dot;
  }
}