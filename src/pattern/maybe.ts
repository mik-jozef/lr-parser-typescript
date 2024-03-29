import { CompositePattern, Pattern, PatternGrammar } from "./pattern.js";
import { Or } from "./or.js";
import { Caten } from "./caten.js";
import { GrammarRule, GrammarSymbol, Nonterminal } from "../grammar.js";
import { SyntaxTreeClass } from "./syntax-tree-node.js";

export class Maybe extends CompositePattern {
  private desugared: Or;
  
  constructor(
    public pattern: Pattern,
    private name: string | null = null,
  ) {
    super();
    
    this.desugared = name === null
      ? new Or(new Caten(), this.pattern)
      : new Or(new Caten(), this.pattern, { patternName: name });
  }
  
  toGrammarRule(grammar: PatternGrammar, ctx: string): GrammarSymbol[];
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: null): GrammarSymbol[];
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: Nonterminal): GrammarRule;
  
  // This is here because TypeScript cannot handle
  // `toGrammarRule(grammar, ctx, null as null | Nonterminal)` otherwise.
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: Nonterminal | null): GrammarSymbol[] | GrammarRule;
  
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: Nonterminal | null = null) {
    let cachedNt = grammar.cachedRuleSources.get(this.desugared) ?? null;
    
    if (cachedNt && this.name === null) {
      throw new Error(`"Maybe" is used in multiple places, but does not have a provided name. Context: ${ctx}.`);
    }
    
    this.desugared.name ??= `${ctx}.Maybe`;
    
    return this.desugared.toGrammarRule(grammar, '(unused)', nt);
  }
  
  getFields(fields: Record<string, boolean> = {}) {
    CompositePattern.getFields(this.pattern, fields);
    
    return fields;
  }
  
  collectSyntaxTreeClasses(
    map = new Map<string, SyntaxTreeClass>(),
  ): Map<string, SyntaxTreeClass> {
    return this.desugared.collectSyntaxTreeClasses(map);
  }
}