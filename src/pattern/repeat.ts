import { CompositePattern, Pattern, PatternGrammar } from "./pattern.js";
import { Caten } from "./caten.js";
import { GrammarRule, GrammarSymbol, Nonterminal } from "../grammar.js";
import { SyntaxTreeClass } from "./syntax-tree-node.js";

export class Repeat extends CompositePattern {
  name: string | null;
  delimiter: Pattern;
  trailingDelimiter: Pattern | null;
  
  // An inclusive lower bound.
  lowerBound: number;
  // An exclusive upper bound.
  upperBound: number;
  
  constructor(
    public pattern: Pattern,
    {
      delimiter = new Caten(),
      trailingDelimiter = false,
      lowerBound = 0,
      upperBound = Infinity,
      name = null,
    }: {
      delimiter?: Pattern,
      trailingDelimiter?: Pattern | boolean,
      lowerBound?: number,
      upperBound?: number,
      name?: string | null,
    } = {}
  ) {
    super();
    
    this.name = name;
    this.delimiter = delimiter;
    this.trailingDelimiter = (() => {
      switch (trailingDelimiter) {
        case false:
          return null;
        case true:
          return this.delimiter;
        default:
          return trailingDelimiter;
      }
    })()
    this.lowerBound = lowerBound;
    this.upperBound = upperBound;
  }
  
  private addToCacheWithUpperBound(
    grammar: PatternGrammar,
    nt: Nonterminal,
    rule: GrammarSymbol[],
    delim: GrammarSymbol[],
    trailing: GrammarSymbol[] | null,
  ) {
    let expansion = [ ...rule ];
    
    // `i === 0` was handled as a special case.
    for (let i = 1; i < this.upperBound; i++) {
      if (this.lowerBound <= i) {
        grammar.insertRule(nt, expansion);
        
        trailing && grammar.insertRule(nt, [ ...expansion, ...trailing ]);
      }
      
      expansion = expansion.concat(...delim, ...rule);
    }
  }
  
  private addToCacheWithoutUpperBound(
    grammar: PatternGrammar,
    nt: Nonterminal,
    rule: GrammarSymbol[],
    delim: GrammarSymbol[],
    trailing: GrammarSymbol[] | null,
    name: string,
  ) {
    const innerNt = grammar.createNonterminal(`${name}['innerLoop']`);
    const prefix = [ ...rule ];
    
    // `i === 0` was handled as a special case.
    for (let i = 1; i < this.lowerBound; i++) {
      prefix.push(...delim, ...rule);
    }
    
    grammar.insertRule(nt, [ ...prefix, innerNt ]);
    
    grammar.insertRule(innerNt, []);
    grammar.insertRule(innerNt, [ ...delim, ...rule, innerNt ]);
    
    trailing && grammar.insertRule(innerNt, [ ...trailing ]);
  }
  
  addToCache(grammar: PatternGrammar, ctx: string) {
    const name = this.name ?? `${ctx}.Repeat`;
    const nt = grammar.createNonterminal(name);
    
    grammar.cachedRuleSources.set(this, nt);
    
    if (this.upperBound <= 0 || this.upperBound <= this.lowerBound) {
      return nt;
    }
    
    const rule = CompositePattern.toGrammarRule(this.pattern, grammar, `${name}['pattern']`);
    const delim = CompositePattern.toGrammarRule(this.delimiter, grammar, `${name}['delimiter']`);
    const trailing = this.trailingDelimiter
      ? CompositePattern.toGrammarRule(this.trailingDelimiter, grammar, `${name}['trailingDelimiter']`)
      : null;
    
    // We need to handle the zeroth iteration as a special case
    // because of the delimiter.
    if (this.lowerBound === 0) {
      grammar.insertRule(nt, []);
    }
    
    if (this.upperBound !== Infinity) {
      this.addToCacheWithUpperBound(grammar, nt, rule, delim, trailing);
    } else {
      this.addToCacheWithoutUpperBound(grammar, nt, rule, delim, trailing, name);
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
    let cachedNt = grammar.cachedRuleSources.get(this) ?? null;
    
    if (cachedNt && this.name === null) {
      throw new Error(`Repeat is used in multiple places, but does not have a provided name. Context: ${ctx}.`);
    }
    
    cachedNt ??= this.addToCache(grammar, ctx);
    
    return nt === null
      ? [ cachedNt ]
      : grammar.insertRule(nt, [ cachedNt ]);
  }
  
  getFields(fields: Record<string, boolean> = {}) {
    CompositePattern.getFields(this.pattern, fields);
    CompositePattern.getFields(this.delimiter, fields);
    
    if (
      this.trailingDelimiter !== null &&
      this.trailingDelimiter !== this.delimiter
    ) {
      CompositePattern.getFields(this.trailingDelimiter, fields);
    }
    
    return fields;
  }
  
  collectSyntaxTreeClasses(
    map = new Map<string, SyntaxTreeClass>(),
  ): Map<string, SyntaxTreeClass> {
    this.pattern instanceof CompositePattern &&
      this.pattern.collectSyntaxTreeClasses(map);
    
    this.delimiter instanceof CompositePattern &&
    this.delimiter.collectSyntaxTreeClasses(map);
    
    this.trailingDelimiter instanceof CompositePattern &&
    this.trailingDelimiter !== this.delimiter &&
      this.trailingDelimiter.collectSyntaxTreeClasses(map);
    
    return map;
  }
}