import { Grammar, GrammarRule, GrammarSymbol, grammarSymbolToString, isNonterminal } from "../../grammar.js";
import { RuleAt } from "./rule-at.js";
import { ParserTable } from "./parser-table.js";
import { PatternGrammar } from "#pattern";

const setsMeet = <T>(a: Set<T>, b: Set<T>): boolean => {
  return [ ...a ].some(elA => b.has(elA));
}

export class GrammarConflict {
  constructor(
    public state: ParserState,
    public under: GrammarSymbol | null,
    public conflictingAction: ParserState | GrammarRule,
  ) {}
}

export class ParserState {
  index: number | null = null;
  
  actions = new Map<GrammarSymbol | null, ParserState | GrammarRule>();
  
  // Only nucleus ruleAts (those with nonzero dot, or the initial ruleAt) are stored.
  ruleAts: RuleAt[] = [];
  
  isAccepting = false;
  
  constructor(
    ruleAts: RuleAt[],
    public exampleLane: (GrammarSymbol | null)[] = [],
  ) {
    ruleAts.forEach(ruleAt => this.insert(ruleAt));
  }
  
  isPopulated() {
    return this.actions.size > 0;
  }
  
  toString(grammar: PatternGrammar) {
    let str =
      `State ${this.index}${this.isAccepting ? ' (the accepting state)' : ''}:\n`
    
    const ruleAts = this.getAllRuleAts(grammar);
    
    ruleAts.forEach(ruleAt => {
      str += `  ${ruleAt.toString(grammar.nonterminalNames)}\n`;
    });
    
    str += 'Actions:\n';
    
    this.actions.forEach((action, under) => {
      const underStr = grammarSymbolToString(grammar.nonterminalNames, under);
      const actionStr = action instanceof GrammarRule
        ? action.toString(grammar.nonterminalNames)
        : `state ${action.index}`;
      
      str += `  ${underStr} --> ${actionStr}\n`;
    });
    
    if (0 < this.exampleLane.length) {
      const exampleLane = this.exampleLane.map(
        (symbol) => grammarSymbolToString(grammar.nonterminalNames, symbol)
      );
      
      str += 'Example lane:\n'
      str += `  ${exampleLane.join(' ')}\n`;
    } else {
      str += 'Example lane: (empty)\n';
    }
    
    return str;
  }
  
  // May leave ruleAts in an inconsistent state -- does not recursively
  // add follow symbols to immediate successor ruleAts.
  static insertToArray(ruleAts: RuleAt[], ruleAt: RuleAt, sort: boolean) {
    const existingRuleAt = ruleAts.find(rule => RuleAt.isIsocore(ruleAt, rule));
    
    if (existingRuleAt) {
      const sizeBefore = existingRuleAt.follow.size;
      
      ruleAt.follow.forEach(symbol => existingRuleAt.follow.add(symbol));
      
      return sizeBefore !== existingRuleAt.follow.size;
    }
    
    ruleAts.push(ruleAt);
    
    sort && ruleAts.sort(RuleAt.compare);
    
    return false;
  }
  
  insert(ruleAt: RuleAt) {
    ParserState.insertToArray(this.ruleAts, ruleAt, true);
    
    // The accepting state has only the initial ruleAt with
    // the dot at the end. No other state has such a ruleAt.
    this.isAccepting =
      this.ruleAts[0]?.rule.head === Grammar.startingSymbol &&
      this.ruleAts[0].dot === 1
  }
  
  private setReduceAction(
    under: GrammarSymbol | null,
    action: GrammarRule,
  ): GrammarConflict | null {
    const existing = this.actions.get(under) ?? null;
    
    if (!existing) {
      this.actions.set(under, action);
      
      return null;
    }
    
    return existing === action ? null : new GrammarConflict(this, under, existing);
  }
  
  private setShiftAction(
    under: GrammarSymbol | null,
    ruleAt: RuleAt,
  ): GrammarConflict | null {
    let maybeParserState = this.actions.get(under);
    
    if (maybeParserState instanceof GrammarRule) {
      return new GrammarConflict(this, under, maybeParserState);
    }
    
    if (!maybeParserState || maybeParserState.isPopulated()) {
      maybeParserState = new ParserState([], [ ...this.exampleLane, under ]);
      
      this.actions.set(under, maybeParserState);
    }
    
    maybeParserState.insert(ruleAt);
    
    return null;
  }
  
  private setActions(grammar: PatternGrammar): GrammarConflict | null {
    for (const ruleAt of this.getAllRuleAts(grammar)) {
      const at = ruleAt.at();
      
      if (at === null) {
        for (const ch of ruleAt.follow) {
          const maybeConflict = this.setReduceAction(ch, ruleAt.rule);
          
          if (maybeConflict) return maybeConflict;
        }
      } else {
        const maybeConflict = this.setShiftAction(at, ruleAt.shift());
        
        if (maybeConflict) return maybeConflict;
      }
    }
    
    return null;
  }
  
  private getAllRuleAts(grammar: PatternGrammar) {
    const ruleAts = [ ...this.ruleAts ];
    
    let change = true;
    
    while (change) {
      change = false;
      
      for (const ruleAt of ruleAts) {
        const at = ruleAt.at();
        
        if (isNonterminal(at)) {
          const follow = ruleAt.followAt(grammar);
          
          grammar.rules
            .filter(rule => rule.head === at)
            .map(rule => new RuleAt(rule, 0, new Set(follow)))
            .forEach(ruleAt => {
              change ||= ParserState.insertToArray(ruleAts, ruleAt, false);
            });
        }
      }
    }
    
    ruleAts.sort(RuleAt.compare);
    
    return ruleAts;
  }
  
  addStates(table: ParserTable) {
    const maybeConflict = this.setActions(table.grammar);
    
    if (maybeConflict) return maybeConflict;
    
    for (const [ under, action ] of this.actions) {
      if (action instanceof ParserState) {
        this.actions.set(under, table.insert(action));
      }
    }
    
    return null;
  }
  
  // TODO delete?
  static equals(a: ParserState, b: ParserState) {
    // We can rely on the ruleAts being sorted.
    return a.ruleAts.length === b.ruleAts.length
      && a.ruleAts.every((ra, i) => RuleAt.equals(ra, b.ruleAts[i]))
  }
  
  static isIsocore(a: ParserState, b: ParserState) {
    // We can rely on the ruleAts being sorted.
    return a.ruleAts.length === b.ruleAts.length
      && a.ruleAts.every((ra, i) => RuleAt.isIsocore(ra, b.ruleAts[i]))
  }
  
  // A practical general method for constructing LR(k) parsers, David Pager, 1977.
  // https://sci-hub.se/https://doi.org/10.1007/BF00290336
  static isWeaklyCompatible(a: ParserState, b: ParserState): boolean {
    if (!ParserState.isIsocore(a, b)) return false;
    
    return a.ruleAts.every((ra, i) => {
      return b.ruleAts.every((rb, j) => {
        return (
          j <= i ||
          !setsMeet(ra.follow, rb.follow) && !setsMeet(b.ruleAts[i].follow, a.ruleAts[j].follow) ||
          setsMeet(ra.follow, a.ruleAts[i].follow) ||
          setsMeet(b.ruleAts[j].follow, rb.follow)
        );
      })
    })
  }
}