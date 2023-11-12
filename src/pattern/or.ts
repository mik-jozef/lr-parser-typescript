import { CompositePattern, isPattern, Pattern, PatternGrammar } from "./pattern.js";
import { GrammarRule, GrammarSymbol, Nonterminal } from "../grammar.js";
import { SyntaxTreeClass } from "./syntax-tree-node.js";

export class Or extends CompositePattern {
  name: string | null = null;
  patterns: Pattern[];
  
  constructor(...patterns: (Pattern | { patternName: string })[]) {
    super();
    
    this.patterns = patterns.filter(isPattern);
    
    for (const pattern of patterns) {
      if (isPattern(pattern)) continue;
      
      if (this.name !== null) {
        throw new Error('Multiple patternNames in Or.');
      }
      
      this.name = pattern.patternName;
    }
  }
  
  addToCache(grammar: PatternGrammar, ctx: string) {
    const name = this.name ?? `${ctx}.Or`;
    const nt = grammar.createNonterminal(name);
    
    grammar.cachedRuleSources.set(this, nt);
    
    this.patterns.forEach((pattern, index) => {
      const ruleName = `${name}[${index}]`;
      
      CompositePattern.toGrammarRule(pattern, grammar, ruleName, nt);
    });
    
    return nt;
  }
  
  toGrammarRule(grammar: PatternGrammar, ctx: string): GrammarSymbol[];
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: null): GrammarSymbol[];
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: Nonterminal): GrammarRule;
  
  // This is here because TypeScript cannot handle
  // `toGrammarRule(grammar, ctx, null as null | Nonterminal)` otherwise.
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: Nonterminal | null): GrammarSymbol[] | GrammarRule;
  
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: Nonterminal | null = null): GrammarSymbol[] | GrammarRule {
    let cachedNt = grammar.cachedRuleSources.get(this) ?? null;
    
    if (cachedNt && this.name === null) {
      throw new Error(`Or is used in multiple places, but does not have a provided name. Context: ${ctx}.`);
    }
    
    cachedNt ??= this.addToCache(grammar, ctx);
    
    return nt === null
      ? [ cachedNt ]
      : grammar.insertRule(nt, [ cachedNt ]);
  }
  
  getFields(fields: Record<string, boolean> = {}) {
    this.patterns.forEach(pattern => CompositePattern.getFields(pattern, fields));
    
    return fields;
  }
  
  collectSyntaxTreeClasses(
    map = new Map<string, SyntaxTreeClass>(),
  ): Map<string, SyntaxTreeClass> {
    this.patterns.forEach((pattern) => {
      pattern instanceof CompositePattern &&
      pattern.collectSyntaxTreeClasses(map);
    })
    
    return map;
  }
}
