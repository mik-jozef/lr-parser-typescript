export type Constructor = new (...args: any[]) => any;

export enum MatchType {
  token = 'token',
  pattern = 'pattern',
}

/*/
  Match infos keep track of which nonterminals correspond
  to which match patterns. This info is used during parsing
  to determine which parts of the parse tree to collect into
  instances of SyntaxTreeNode (or as a token, or a token array).
/*/
export class MatchInfo<STC extends Constructor> {
  constructor(
    public isArrayMatch: boolean,
    public prop: string,
    public match: STC | MatchType,
  ) {}
}

export type Context = Set<string | null>;

export type Terminal = string;
export type Nonterminal = number;
export type GrammarSymbol = Terminal | Nonterminal;

export function isTerminal(value: unknown): value is Terminal {
  return typeof value === 'string';
}

export function isNonterminal(value: unknown): value is Nonterminal {
  return typeof value === 'number';
}

// Accepts augmented grammar symbols -- ie. including null.
export function grammarSymbolToString(
  nonterminalNames: Map<Nonterminal, string>,
  symbol: GrammarSymbol | null,
): string {
  if (typeof symbol === 'string') return `"${symbol.replace(/"/g, '\\"')}"`;
  if (typeof symbol === 'number') return nonterminalNames.get(symbol)!;
  
  return '(end of input)';
}

export class GrammarRule {
  constructor(
    public head: Nonterminal,
    public expansion: GrammarSymbol[],
    // Index of the rule in the grammar.
    public index: number,
  ) {}
  
  toString(nonterminalNames: Map<Nonterminal, string>) {
    const head = grammarSymbolToString(nonterminalNames, this.head);
    const expansion = this.expansion.map(
      symbol => grammarSymbolToString(nonterminalNames, symbol)
    );
    
    return `rule ${this.index}: ${head} -> ${expansion.join(' ')}`;
  }
}

// `Cacheable` is something that is capable of producing grammar rules.
// STC, or a syntax tree class, is a class that is capable of representing
// a portion of the parse tree (ie. a syntax tree node).
export class Grammar<Cacheable, STC extends Constructor> {
  static startingSymbol: number = 0;
  
  zerothSets = new Map<Nonterminal, Context>();
  
  rules: GrammarRule[] = [];
  
  // The least natural number not yet used as a nonterminal symbol.
  // Zero is reserved for the augmented starting symbol.
  nonterminalIndex = 1;
  
  // Used for pretty-printing the grammar.
  nonterminalNames = new Map<Nonterminal, string>([
    [ Grammar.startingSymbol, '(starting symbol)' ],
  ]);
  
  // A map from nonterminals generated by instances of MatchBase
  // to their match infos.
  nonterminalMatchInfos = new Map<number, MatchInfo<STC>>();
  
  // Maps a pattern to its nonterminal.
  cachedRuleSources = new Map<Cacheable, number>();
  
  private insertNonterminal(nt: Nonterminal) {
    this.zerothSets.has(nt) || this.zerothSets.set(nt, new Set());
  }
  
  insertRule(nt: Nonterminal, expansion: GrammarSymbol[]) {
    const rule = new GrammarRule(nt, expansion, this.rules.length);
    
    this.rules.push(rule);
    
    this.insertNonterminal(nt);
    expansion.forEach(s => isNonterminal(s) && this.insertNonterminal(s));
    
    return rule;
  }
  
  
  createNonterminal(name: string, matchInfo: MatchInfo<STC> | null = null) {
    const ntNumber = this.nonterminalIndex;
    
    this.nonterminalIndex += 1;
    
    this.nonterminalNames.set(ntNumber, name);
    
    matchInfo === null || this.nonterminalMatchInfos.set(ntNumber, matchInfo);
    
    return ntNumber;
  }
}