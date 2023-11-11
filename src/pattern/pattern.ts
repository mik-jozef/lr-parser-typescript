import { Grammar, GrammarRule, GrammarSymbol, Nonterminal } from "../grammar.js";
import { SyntaxTreeClass } from "./syntax-tree-node.js";

export type Pattern = CompositePattern | string;

export type PatternGrammar = Grammar<Pattern | SyntaxTreeClass, SyntaxTreeClass>;

export const isPattern = (pattern: Pattern | { patternName: string }): pattern is Pattern => {
  return typeof pattern === 'string' || pattern instanceof CompositePattern;
};

export abstract class CompositePattern {
  abstract toGrammarRule(grammar: PatternGrammar, ctx: string): GrammarSymbol[];
  abstract toGrammarRule(grammar: PatternGrammar, ctx: string, nt: null): GrammarSymbol[];
  abstract toGrammarRule(grammar: PatternGrammar, ctx: string, nt: Nonterminal): GrammarRule;
  
  // This is here because TypeScript cannot handle
  // `toGrammarRule(grammar, ctx, null as null | Nonterminal)` otherwise.
  abstract toGrammarRule(grammar: PatternGrammar, ctx: string, nt: Nonterminal | null): GrammarSymbol[] | GrammarRule;
  
  // `Record[Prop, IsArray]`.
  abstract getFields(fields?: Record<string, boolean>): Record<string, boolean>;
  
  abstract collectSyntaxTreeClasses(map?: Map<string, SyntaxTreeClass>): Map<string, SyntaxTreeClass>;
  
  static toGrammarRule(pattern: Pattern, grammar: PatternGrammar, ctx: string): GrammarSymbol[];
  static toGrammarRule(pattern: Pattern, grammar: PatternGrammar, ctx: string, nt: null): GrammarSymbol[];
  static toGrammarRule(pattern: Pattern, grammar: PatternGrammar, ctx: string, nt: Nonterminal): GrammarRule;
  
  // This is here because TypeScript cannot handle
  // `toGrammarRule(pattern, grammar, null as null | Nonterminal)` otherwise.
  static toGrammarRule(pattern: Pattern, grammar: PatternGrammar, ctx: string, nt: Nonterminal | null): GrammarSymbol[] | GrammarRule;
  
  static toGrammarRule(
    pattern: Pattern,
    grammar: PatternGrammar,
    ctx: string,
    nt: Nonterminal | null = null,
  ) {
    if (typeof pattern === 'string') {
      return nt === null
        ? [ pattern ]
        : grammar.insertRule(nt, [ pattern ]);
    }
    
    return pattern.toGrammarRule(grammar, ctx, nt);
  }
  
  static getFields(pattern: Pattern, fields: Record<string, boolean> = {}) {
    if (typeof pattern === 'string') return fields;
    
    return pattern.getFields(fields);
  }
}

/*/
  TODO: create subclass Assert with `prop: string` and `shape: AssertShape`.
  
  type AssertShape = { [key: string]: string | Enum | AssertShape };
/*/
