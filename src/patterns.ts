import { Grammar, GrammarSymbol, Nonterminal } from './parser.js';


export abstract class SyntaxTreeNode {
  static hidden = false; // This is class ? True : Bool;
  
  static rule: Pattern;
  
  static fields: Record<string, boolean>;
  
  parent: SyntaxTreeNode | null = null;
  
  constructor(obj: object) {
    Object.assign(this, obj);
    
    function setParent(child: unknown, parent: SyntaxTreeNode) {
      child instanceof SyntaxTreeNode && (child.parent = parent);
    }
    
    ( Object.keys(this) as (keyof this)[] )
      .forEach(key => Array.isArray(this[key])
        ? (this[key] as any).forEach((val: unknown) => setParent(val, this))
        : setParent(this[key], this),
      );
  }
}

export type SyntaxTreeClass = typeof SyntaxTreeNode & (new(...args: any) => SyntaxTreeNode);

export abstract class Pattern {
  abstract kind: string;
  
  abstract toGrammarRule(grammar: Grammar, nt?: Nonterminal): GrammarSymbol[];
  
  // `Record[Prop, IsArray]`.
  abstract getFields(fields?: Record<string, boolean>): Record<string, boolean>;
}

export class Caten extends Pattern {
  kind: 'Caten' = 'Caten';
  
  exprs: Pattern[];
  
  constructor(...exprs: Pattern[]) {
    super();
    
    this.exprs = exprs;
  }
  
  toGrammarRule(grammar: Grammar, nt?: Nonterminal): GrammarSymbol[] {
    const exprs = this.exprs.flatMap(expr => expr.toGrammarRule(grammar));
    
    if (nt === undefined) return exprs;
    
    grammar.insertRule(nt, exprs);
    
    return [ nt ];
  }
  
  getFields(fields: Record<string, boolean> = {}) {
    this.exprs.forEach(expr => expr.getFields(fields));
    
    return fields;
  }
}

export class Or extends Pattern {
  kind: 'Or' = 'Or';
  
  exprs: Pattern[];

  constructor(...exprs: Pattern[]) {
    super();
    
    this.exprs = exprs;
  }
  
  toGrammarRule(grammar: Grammar, nt?: Nonterminal): GrammarSymbol[] {
    if (nt === undefined) {
      if (grammar.orPatterns.has(this)) return [ grammar.orPatterns.get(this)! ];
      
      nt = grammar.createNt();
      
      grammar.orPatterns.set(this, nt);
    }
    
    this.exprs.forEach(expr => expr.toGrammarRule(grammar, nt));
    
    return [ nt ];
  }
  
  getFields(fields: Record<string, boolean> = {}) {
    this.exprs.forEach(expr => expr.getFields(fields));
    
    return fields;
  }
}

export class Maybe extends Pattern {
  kind: 'Maybe' = 'Maybe';
  
  private desugared: Pattern;
  
  constructor(
    public expr: Pattern,
  ) {
    super();
    
    this.desugared = new Or(new Caten(), this.expr);
  }
  
  toGrammarRule(grammar: Grammar, nt?: Nonterminal): GrammarSymbol[] {
    return this.desugared.toGrammarRule(grammar, nt);
  }
  
  getFields(fields: Record<string, boolean> = {}) {
    this.expr.getFields(fields);
    
    return fields;
  }
}

export class Repeat extends Pattern {
  kind: 'Repeat' = 'Repeat';
  
  constructor(
    public expr: Pattern,
    public delimiter: Pattern = new Caten(),
    public allowTrailingDelimiter: boolean = false,
    public lowerBound: number = 0,
    // Exclusive upper bound.
    public upperBound: number = Infinity,
    //private includeDelimiter = false,
  ) {
    super();
    
    if (this.upperBound < this.lowerBound) throw new Error('repeat bad (max < min)');
  }
  
  toGrammarRule(grammar: Grammar, nt: Nonterminal = grammar.createNt()):
    GrammarSymbol[]
  {
    if (this.upperBound <= 0 || this.lowerBound === this.upperBound) {
      return [ nt ];
    }
    
    const rule = this.expr.toGrammarRule(grammar);
    const delim = this.delimiter.toGrammarRule(grammar);
    
    // We need to handle the zeroth iteration as a special
    // case because of the delimiter.
    if (this.lowerBound === 0) {
      grammar.insertRule(nt, []);
      
      this.allowTrailingDelimiter &&
        grammar.insertRule(nt, delim);
    }
    
    if (this.upperBound !== Infinity) {
      const expansion = [ ...rule ];
      
      // `i === 0` was handled above as a special case.
      for (let i = 1; i < this.upperBound; i++) {
        if (this.lowerBound <= i) {
          grammar.insertRule(nt, expansion);
          
          this.allowTrailingDelimiter &&
            grammar.insertRule(nt, [ ...expansion, ...delim ]);
        }
        
        expansion.concat(...delim, ...rule);
      }
    } else {
      const innerNt = grammar.createNt();
      const prefix = [ ...rule ];
      
      // `i === 0` was handled above as a special case.
      for (let i = 1; i < this.lowerBound; i++) {
        prefix.concat(...delim, ...rule);
      }
      
      grammar.insertRule(nt, [ ...prefix, innerNt ]);
      
      grammar.insertRule(innerNt, []);
      grammar.insertRule(innerNt, [ ...delim, ...rule, innerNt ]);
      
      this.allowTrailingDelimiter &&
        grammar.insertRule(innerNt, [ ...delim ]);
    }
    
    return [ nt ];
  }
  
  getFields(fields: Record<string, boolean> = {}) {
    this.expr.getFields(fields);
    this.delimiter.getFields(fields);
    
    return fields;
  }
}

export class Match extends Pattern {
  kind: 'Match' = 'Match';
  
  nt!: number; // Used for serialization.
  
  constructor(
    public isArray: boolean,
    public prop: string,
    public match: SyntaxTreeClass | Pattern,
  ) { super(); }
  
  toGrammarRule(grammar: Grammar, nt?: Nonterminal): GrammarSymbol[] {
    if (!this.match) {
      console.log(this);
      throw new Error('You forgot to patch an uninitialized Equals.');
    }
    
    if (grammar.matchPatterns.has(this)) {
      if (nt !== undefined) {
        grammar.rules.some(rule => {
          return rule.nt === nt && rule.expansion.length === 1 && rule.expansion[0] === this;
        })
        || grammar.insertRule(nt, [ this ]);
        
        return [ nt ];
      }
      
      return [ this ];
    }
    
    grammar.matchPatterns.add(this);
    
    this.nt = grammar.createNt(this);
    
    if (this.match instanceof Pattern) {
      this.match.toGrammarRule(grammar, this);
    } else {
      grammar.insertRule(this, [ this.match ]);
      
      grammar.insertSyntaxTreeClass(this.match);
    }
    
    if (nt === undefined) return [ this ];
    
    grammar.insertRule(nt, [ this ]);
    
    return [ nt ];
  }
  
  getFields(fields: Record<string, boolean> = {}) {
    if (this.prop in fields && fields[this.prop] !== this.isArray) {
      throw new Error('isArray mismatch: "' + this.prop + '"');
    }
    
    fields[this.prop] = this.isArray;
    
    return fields;
  }
}
