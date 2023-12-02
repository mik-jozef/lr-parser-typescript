import { isSyntaxTreeClass, SyntaxTreeClass } from "./syntax-tree-node.js";
import { CompositePattern, Pattern, PatternGrammar } from "./pattern.js";
import { GrammarRule, GrammarSymbol, MatchInfo, MatchType, Nonterminal } from "../grammar.js";

export abstract class MatchBase extends CompositePattern {
  abstract isArrayMatch: boolean;
  
  constructor(
    public prop: string | null,
    public match: SyntaxTreeClass | Pattern,
    // The name of the corresponding nonterminal in the grammar.
    // Used to print the grammar in case of grammar conflicts.
    public name: string | null = null,
  ) {
    super();
  }
  
  addToCache(grammar: PatternGrammar, ctx: string) {
    const name = this.name ?? `${ctx}.${this.constructor.name}`;
    
    const matchInfo = this.prop
      ? new MatchInfo(
          this.isArrayMatch,
          this.prop,
          isSyntaxTreeClass(this.match)
            ? this.match
            : typeof this.match === 'string'
            ? MatchType.token
            : MatchType.pattern,
        )
      : null;
    
    const nt = grammar.createNonterminal(name, matchInfo);
    
    grammar.cachedRuleSources.set(this, nt);
    
    if (typeof this.match === 'string' || this.match instanceof CompositePattern) {
      CompositePattern.toGrammarRule(this.match, grammar, name, nt);
    } else {
      const stcNt = MatchBase.insertSyntaxTreeClass(grammar, this.match);
      
      grammar.insertRule(nt, [ stcNt ]);
    }
    
    return nt;
  }
  
  toGrammarRule(grammar: PatternGrammar, ctx: string): GrammarSymbol[];
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: null): GrammarSymbol[];
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: Nonterminal): GrammarRule;
  
  // This is here because TypeScript cannot handle
  // `toGrammarRule(grammar, ctx, null as null | Nonterminal)` otherwise.
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: Nonterminal | null): GrammarSymbol[] | GrammarRule;
  
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: Nonterminal | null = null): GrammarSymbol[] | GrammarRule {
    if (!this.match) {
      throw new Error(`You forgot to patch an uninitialized Match at ${ctx}.`);
    }
    
    let cachedNt = grammar.cachedRuleSources.get(this) ?? null;
    
    if (cachedNt && this.name === null) {
      throw new Error(`"${this.constructor.name}" is used in multiple places, but does not have a provided name. Context: ${ctx}.`);
    }
    
    cachedNt ??= this.addToCache(grammar, ctx);
    
    return nt === null
      ? [ cachedNt ]
      : grammar.insertRule(nt, [ cachedNt ]);
  }
  
  getFields(fields: Record<string, boolean> = {}) {
    if (this.prop === null) return fields;
    
    if (this.prop in fields && fields[this.prop] !== this.isArrayMatch) {
      throw new Error('isArrayMatch mismatch: "' + this.prop + '"');
    }
    
    fields[this.prop] = this.isArrayMatch;
    
    return fields;
  }
  
  static insertSyntaxTreeClass(grammar: PatternGrammar, stc: SyntaxTreeClass) {
    const cached = grammar.cachedRuleSources.get(stc) ?? null;
    
    if (cached) return cached;
    
    for (const ruleSource of grammar.cachedRuleSources) {
      if (isSyntaxTreeClass(ruleSource) && stc.name === ruleSource.name) {
        throw new Error(`Duplicate name "${stc.name}". Every SyntaxTreeNode class of a grammar must have a unique name.`)
      }
    }
    
    const nt = grammar.createNonterminal(stc.name);
    
    grammar.cachedRuleSources.set(stc, nt);
    
    stc.fields ??= CompositePattern.getFields(stc.pattern);
    
    CompositePattern.toGrammarRule(stc.pattern, grammar, stc.name, nt);
    
    return nt;
  }
  
  collectSyntaxTreeClasses(
    map = new Map<string, SyntaxTreeClass>(),
  ): Map<string, SyntaxTreeClass> {
    if (isSyntaxTreeClass(this.match)) {
      if (map.has(this.match.name)) return map;
      
      map.set(this.match.name, this.match);
      
      this.match.pattern instanceof CompositePattern &&
        this.match.pattern.collectSyntaxTreeClasses(map);
      
      this.match.fields ??= CompositePattern.getFields(this.match.pattern);
    }
    
    this.match instanceof CompositePattern &&
      this.match.collectSyntaxTreeClasses(map);
    
    return map;
  }
}

export class Match extends MatchBase {
  isArrayMatch: false = false;
  
  constructor(
    prop: string | null,
    match: SyntaxTreeClass | Pattern,
    name: string | null = null,
  ) {
    super(prop, match, name);
  }
}

export class MatchArr extends MatchBase {
  isArrayMatch: true = true;
  
  constructor(
    prop: string,
    match: SyntaxTreeClass | Pattern,
    name: string | null = null,
  ) {
    super(prop, match, name);
  }
}
