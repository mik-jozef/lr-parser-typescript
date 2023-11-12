import { CompositePattern, Pattern, PatternGrammar } from "./pattern.js";
import { GrammarRule, GrammarSymbol, Nonterminal } from "../grammar.js";
import { SyntaxTreeClass } from "./syntax-tree-node.js";


export class Caten extends CompositePattern {
  patterns: Pattern[];
  
  constructor(...patterns: Pattern[]) {
    super();
    
    this.patterns = patterns;
  }
  
  toGrammarRule(grammar: PatternGrammar, ctx: string): GrammarSymbol[];
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: null): GrammarSymbol[];
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: Nonterminal): GrammarRule;
  
  // This is here because TypeScript cannot handle
  // `toGrammarRule(grammar, ctx, null as null | Nonterminal)` otherwise.
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: Nonterminal | null): GrammarSymbol[] | GrammarRule;
  
  toGrammarRule(grammar: PatternGrammar, ctx: string, nt: Nonterminal | null = null) {
    const patterns = this.patterns.flatMap((pattern, index) => {
      return CompositePattern.toGrammarRule(pattern, grammar, `${ctx}.Caten[${index}]`);
    });
    
    return nt === null
      ? patterns
      : grammar.insertRule(nt, patterns);
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
