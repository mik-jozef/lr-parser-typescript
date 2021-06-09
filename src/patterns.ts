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
  
  constructor(
    public expr: Pattern,
  ) { super(); }
  
  toGrammarRule(grammar: Grammar, nt?: Nonterminal): GrammarSymbol[] {
    return new Or(new Caten(), this.expr).toGrammarRule(grammar, nt);
  }
  
  getFields(fields: Record<string, boolean> = {}) {
    this.expr.getFields(fields);
    
    return fields;
  }
}

export class Repeat extends Pattern {
  kind: 'Repeat' = 'Repeat';
  
  constructor(
    // TODO exclude weird unprintable ASCII chars.
    public expr: Pattern,
    public delimiter: Pattern = new Caten(),
    public min: number = 0,
    public max: number = Infinity,
    //private includeDelimiter = false,
  ) {
    super();
    
    if (this.max < this.min) throw new Error('repeat bad');
  }
  
  toGrammarRule(grammar: Grammar, nt?: Nonterminal): GrammarSymbol[] {
    const delim = this.delimiter.toGrammarRule(grammar);
    const once = this.expr.toGrammarRule(grammar);
    
    function doStep(
      nt: Nonterminal | undefined,
      min: number, max: number,
      includeDelimiter: boolean,
    ): GrammarSymbol[] {
      if (0 < min) {
        const expansion = [
          ...(includeDelimiter ? delim : []),
          ...once,
          ...doStep(undefined, min - 1, max - 1, true),
        ];
        
        nt === undefined || grammar.insertRule(nt, expansion);
        
        return nt === undefined ? expansion : [ nt ];
      }
      
      if (max === 0) {
        nt === undefined || grammar.insertRule(nt, []);
        
        return nt === undefined ? [] : [ nt ];
      }
      
      if (max === Infinity) {
        if (nt === undefined) nt = grammar.createNt();
        
        if (includeDelimiter) {
          grammar.insertRule(nt, []);
          grammar.insertRule(nt, [ ...delim, ...once, nt, ]);
        } else {
          const innerNt = grammar.createNt();
          
          grammar.insertRule(nt, []);
          grammar.insertRule(nt, [ ...once, innerNt, ]);
          
          grammar.insertRule(innerNt, []);
          grammar.insertRule(innerNt, [ ...delim, ...once, innerNt, ]);
        }
        
        return [ nt ];
      }
      
      const expansion = [
        ...(includeDelimiter ? delim : []),
        ...once,
        ...doStep(undefined, 0, max - 1, true),
      ];
      
      nt === undefined || grammar.insertRule(nt, expansion);
      
      return nt === undefined ? expansion : [ nt ];
    }
    
    return doStep(nt, this.min, this.max, false);
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
      throw new Error('isArray mismatch');
    }
    
    fields[this.prop] = this.isArray;
    
    return fields;
  }
}
