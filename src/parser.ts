import { inspect } from 'util';
import { readFileSync, writeFileSync } from 'fs';

import { SyntaxTreeClass, Match, SyntaxTreeNode, Or } from "./patterns.js";
import { TokenizationError, TokenKind, SrcPosition, Token, Tokenizer } from "./tokenizer.js";
import { getZerothOfRule, computeZeroth } from "./zeroth.js";


// Improvement once you start implementing attributes, use a GrammarExplorer
// to compute viable paths beforehand, so that parsing `Caten(..., Equals(...))`
// where the equals does not match will fail right at the start, and not at the
// position of equals.

// Attributes: "generate rules for all possible combinations" vs "collapse
// combinations into specific rules". If you want to support nested constraints,
// you have no choice but to collapse rules.

// This piece of code is almost indispensable when debugging grammar conflicts:
// TODO use it to print better error messages.
// function getNames(r) {
//   return r ? [ r.rule.nt.name ? [ r.rule.nt.name ] : [], ...nameArr, ...getNames(r.parent) ] : [];
// }

export type Context = Set<TokenKind<any> | null>;

export type Nonterminal = Match | SyntaxTreeClass | number;
export type GrammarSymbol = Nonterminal | TokenKind<any>;

function isNonterminal(value: unknown): value is Nonterminal {
  return value instanceof Match
    || typeof value === 'function'
    || typeof value === 'number'
  ;
}

export class GrammarRule {
  constructor(
    public nt: Nonterminal,
    public expansion: GrammarSymbol[],
    // Index of the rule in the grammar.
    public index: number,
  ) {}
}

class RuleAt {
  at(): GrammarSymbol | null { return this.rule.expansion[this.dot] || null };
  
  constructor(
    public parent: RuleAt | null,
    public rule: GrammarRule,
    public dot: number,
    public follow: Context,
  ) {}
  
  followAt(grammar: Grammar) {
    return getZerothOfRule(
      grammar.zerothSets,
      this.rule.expansion,
      this.follow,
      this.dot + 1,
    );
  }
  
  shift(): RuleAt {
    if (this.at() === null) throw new Error('at null');
    
    return new RuleAt(this.parent, this.rule, this.dot + 1, this.follow);
  }
  
  static equals(a: RuleAt, b: RuleAt): boolean {
    return a.rule === b.rule
      && a.dot === b.dot
      && a.follow.size === b.follow.size
      && [...a.follow].every(e => b.follow.has(e))
    ;
  }
}

export class Grammar {
  zerothSets = new Map<Nonterminal, Context>();
  
  rules: GrammarRule[] = [];
  
  topNonterminal = 0; // `this.createNt();` cannot be used, because ntIndex is not yet initialized.
  
  ntIndex = 1;
  
  insertedStcs = new Set<SyntaxTreeClass>();
  
  ntNumberToNt = new Map<number | null, Nonterminal | null>([ [ null, null ] ]);
  ntToNtNumber = new Map<Nonterminal | null, number | null>([ [ null, null ] ]);
  
  // IMPROVEMENT can these be merged into one map?
  matchPatterns = new Set<Match>();
  orPatterns = new Map<Or, number>();
  
  private insertContext(nt: Nonterminal) {
    this.zerothSets.has(nt) || this.zerothSets.set(nt, new Set());
  }
  
  insertRule(nt: Nonterminal, expansion: GrammarSymbol[]) {
    this.rules.push(new GrammarRule(nt, expansion, this.rules.length));
    
    this.insertContext(nt);
    expansion.forEach(s => isNonterminal(s) && this.insertContext(s));
  }
  
  insertSyntaxTreeClass(stc: SyntaxTreeClass) {
    if (this.insertedStcs.has(stc)) return;
    
    this.insertedStcs.add(stc);
    this.createNt(stc);
    stc.fields = stc.rule.getFields();
    
    stc.rule.toGrammarRule(this, stc);
  }
  
  createNt(nt: Match | SyntaxTreeClass | null = null) {
    const ntNumber = this.ntIndex++;
    
    this.ntNumberToNt.set( ntNumber, nt === null ? ntNumber : nt );
    this.ntToNtNumber.set( nt === null ? ntNumber : nt, ntNumber );
    
    return ntNumber;
  }
}

type SerializedTransition = {
  under: string | number | null;
  to: {
    read: boolean,
    index: number,
  }
};

type SerializedParserState = {
  canStep: boolean,
  transitions: SerializedTransition[];
};

class ParserStates {
  states: ParserState[] = [];
  
  constructor(
    public grammar: Grammar,
    public doLog: boolean,
  ) {}
  
  insert(state: ParserState) {
    const foundState = this.states.find(s => ParserState.equals(s, state));
    
    if (foundState) return foundState;
    
    this.states.push(state);
    
    this.states.length % 128 === 0 && this.doLog
      && console.log(`Generated ${this.states.length} states.`);
    
    return state;
  }
  
  expand(i = 0) {
    if (this.states.length <= i) return;
    
    this.states[i].addStates(this);
    
    this.expand(i + 1);
  }
  
  save(path: string) {
    let index = 0;
    
    this.states.forEach(state => state.index = index++);
    
    writeFileSync(path, JSON.stringify(this.states.map((state): SerializedParserState => {
      return {
        canStep: state.canStep,
        transitions: [...state.transitions].map(([ under, to ]) => {
          return {
            under: under instanceof TokenKind
              ? under.token : this.grammar.ntToNtNumber.get(under)!,
            to: {
              read: to instanceof ParserState,
              index: to.index,
            }
          };
        }),
      };
    })));
  }
}

class ParserState {
  index!: number;
  
  transitions = new Map<GrammarSymbol | null, GrammarRule | ParserState>();
  
  ruleAts: RuleAt[] = [];
  
  canStep = false;
  
  constructor(
    ruleAts: RuleAt[],
    grammar: Grammar,
    // List of visited stcs, hopefully helpful for debugging.
    public createdBy: ParserState | null = null,
    public stcs: (SyntaxTreeClass | TokenKind<any> | null)[] = [],
    under: GrammarSymbol | null = null,
  ) {
    ruleAts.forEach(ruleAt => this.insert(grammar, ruleAt, false));
    
    this.stcs.push(
      typeof under === 'function' || under instanceof TokenKind
        ? under : null,
    );
    
    this.expand(grammar);
  }
  
  setTransition(grammar: Grammar, under: GrammarSymbol | null, to: GrammarRule | RuleAt) {
    if (to instanceof GrammarRule) {
      if (this.transitions.has(under)) {
        if (this.transitions.get(under) !== to) {
          throw new Error('grammar conflict (a)');
        }
      } else {
        this.transitions.set(under, to);
      }
    } else {
      if (!this.transitions.has(under)) {
        this.transitions.set(
          under,
          new ParserState([], grammar, this, [ ...this.stcs ], under),
        );
      }
      
      const maybeParserState = this.transitions.get(under)!;
      
      if (maybeParserState instanceof GrammarRule) {
        throw new Error('grammar conflict (b)');
      }
      
      maybeParserState.insert(grammar, to);
    }
  }
  
  expand(grammar: Grammar, i = 0) {
    if (this.ruleAts.length <= i) return;
    
    const ruleAt = this.ruleAts[i];
    const at = ruleAt.at();
    
    if (isNonterminal(at)) {
      const follow = ruleAt.followAt(grammar);
      
      grammar.rules
        .filter(rule => rule.nt === at)
        .map(rule => new RuleAt(ruleAt, rule, 0, follow))
        .forEach(ruleAt => this.insert(grammar, ruleAt, false));
    }
    this.expand(grammar, i + 1);
  }
  
  insert(grammar: Grammar, ruleAt: RuleAt, expand = true) {
    if (this.transitions.size > 0) throw new Error('cannot insert if transitions populated');
    
    const isUnique = this.ruleAts.every(rule => !RuleAt.equals(ruleAt, rule));
    
    if (isUnique) {
      this.ruleAts.push(ruleAt);
      
      this.canStep = 0 < this.ruleAts.length
        && (this.ruleAts[0].rule.nt !== 0 || this.ruleAts[0].dot !== 1);
      
      expand && this.expand(grammar, this.ruleAts.length - 1);
    }
  }
  
  private populateTransitions(grammar: Grammar) {
    for (const ruleAt of this.ruleAts) {
      const at = ruleAt.at();
      
      if (at === null) {
        for (const ch of ruleAt.follow) {
          this.setTransition(grammar, ch, ruleAt.rule);
        }
      } else {
        this.setTransition(grammar, at, ruleAt.shift());
      }
    }
  }
  
  addStates(parserStates: ParserStates) {
    this.populateTransitions(parserStates.grammar);
    
    for (const [ under, to ] of this.transitions) {
      if (to instanceof ParserState) {
        this.transitions.set(under, parserStates.insert(to));
      }
    }
  }
  
  static equals(a: ParserState, b: ParserState) {
    return a.ruleAts.length === b.ruleAts.length
      && a.ruleAts.every(ra => b.ruleAts.some(rb => RuleAt.equals(ra, rb)));
  }
}

type ParseHeadValue = Record<string, Token<any> | SyntaxTreeNode | MergedTokens | (Token<any> | SyntaxTreeNode | MergedTokens)[]>;

function mergeValues(head: ParseHead, count: number): [ ParseHead, ParseHeadValue, Token<any>[] ] {
  if (count === 0) return [ head, {}, [] ];
  
  const [ prevHead, value, tokens ] = mergeValues(head.previous!, count - 1);
  
  for (const key of Object.keys(head.value)) {
    value[key] = key in value
      ? [ ...(value[key] as any), ...head.value[key] as Array<any> ]
      : head.value[key]
    ;
  }
  
  head.tokens.forEach(token => tokens.push(token));
  
  return [ prevHead, value, tokens ];
};

export interface MergedTokens {
  value: string;
  start: SrcPosition | null;
  end: SrcPosition | null;
  tokenKind: null;
};

class ParseHead {
  constructor(
    public state: ParserState,
    public previous: ParseHead | null,
    public tokens: Token<any>[],
    public value: ParseHeadValue,
  ) {}
  
  step(
    word: string,
    token: Token<any> | null,
  ): [ ParseHead | null, boolean ] {
    const transition = this.state.transitions.get(token ? token.kind : null);
    
    if (!transition) {
      console.log(
        'Expected one of:',
        [ ...this.state.transitions ]
          .filter(t => t[0] instanceof TokenKind)
          .map(t => (t[0] as TokenKind<any>)!.token),
      );
      
      return [ null, false ];
    }
    
    if (transition instanceof ParserState) {
      return [ new ParseHead(
        transition,
        this,
        token ? [ token ] : [],
        {},
      ), true ];
    }
    
    let [ prevHead, value, tokens ] = mergeValues(this, transition.expansion.length);
    
    // IMPROVEMENT: for every Pattern, compute the set of props that it
    // can potentially match, and if it does not, add an empty array of them.
    if (transition.nt instanceof Match) {
      function addUnmatched(value: any) {
        const fields = (((transition as GrammarRule).nt as Match).match as SyntaxTreeClass).fields;
        
        Object.keys(fields).forEach(key => {
          if (!(key in value)) {
            value[key] = fields[key] ? [] : null;
          }
        });
        
        return value;
      }
      
      const toInsert = typeof transition.nt.match === 'function'
        // @ts-expect-error shut up TS ur just dumb. It's not an abstract class.
        ? (transition.nt.match.hidden ? value.value : new transition.nt.match(addUnmatched(value)))
        : transition.nt.match instanceof TokenKind
            ? tokens[0]
            : tokens.length === 0
                ? { start: token?.start || null, end: token?.end || null, value: '', tokenKind: null }
                : {
                    start: tokens[0].start,
                    end: tokens[tokens.length - 1].end,
                    value: word.substring(tokens[0].start.i, tokens[tokens.length - 1].end.i),
                    tokenKind: null,
                  }
      ;
      
      typeof transition.nt.match === 'function' && (value = {});
      
      if (transition.nt.isArray) {
        transition.nt.prop in value || (value[transition.nt.prop] = []);
        
        (value[transition.nt.prop] as Array<any>).push(toInsert);
      } else {
        value[transition.nt.prop] = toInsert;
      }
    }
    
    return [ new ParseHead(
      prevHead.state.transitions.get(transition.nt) as ParserState,
      prevHead,
      tokens,
      value,
    ), false ];
  }
}

export class Parser<TokenString extends string, Stc extends SyntaxTreeClass> {
  initialState: ParserState;
  
  constructor(
    public tokenizer: Tokenizer<TokenString>,
    stc: Stc,
    parserTablePath: string | null,
    doLog = false,
  ) {
    const grammar: Grammar = new Grammar();
    const equals = new Match(false, 'root', stc);
    const rule = new GrammarRule(grammar.topNonterminal, [ equals ], null!);
    const ruleAt = new RuleAt(null, rule, 0, new Set([ null ]));
    
    equals.toGrammarRule(grammar);
    computeZeroth(grammar);
    
    if (parserTablePath !== null) {
      try {
        doLog && console.log('About to read the parser table.');
        
        const table = readFileSync(parserTablePath, 'utf8');
        
        doLog && console.log('Parser table found.');
        
        const statesInfo = JSON.parse(table) as SerializedParserState[];
        const parserStates = statesInfo.map((_: any) => new ParserState([], grammar));
        
        parserStates.forEach((state, i) => {
          state.canStep = statesInfo[i].canStep;
          statesInfo[i].transitions.forEach(( { under: underRaw, to } ) => {
            const under = typeof underRaw === 'string'
              ? tokenizer.token(underRaw as TokenString)
              : grammar.ntNumberToNt.get(underRaw)!;
            
            state.transitions.set(
              under,
              (to.read ? parserStates : grammar.rules)[to.index],
            );
          });
        });
        
        this.initialState = parserStates[0];
        
        return;
      } catch (e: any) {
        e.code === 'ENOENT' || console.log(e);
        doLog && console.log('Parser table not found, generating.');
      }
    }
    
    this.initialState = new ParserState([ ruleAt ], grammar);
    
    const parserStates = new ParserStates(grammar, doLog);
    
    parserStates.insert(this.initialState);
    parserStates.expand();
    
    doLog && console.log('Grammar size:', grammar.rules.length);
    doLog && console.log('Parser size:', parserStates.states.length);
    
    parserTablePath !== null &&
      parserStates.save(parserTablePath);
  }
  
  // SyntaxTreeNode - successfully parsed.
  // Token - parse error at token.
  // null - parse error at end of file.
  parse(word: string, doLog = false): InstanceType<Stc> | Token<TokenString | 'identifier' | 'number' | 'text'> | TokenizationError | null {
    const tokenizer = this.tokenizer.tokenize(word);
    
    let head: ParseHead | null = new ParseHead(this.initialState, null, [], {});
    let token = tokenizer.next().value;
    
    for (; head && (token || head.state.canStep);) {
      if (token instanceof TokenizationError) return token;
      
      let didRead;
      
      [ head, didRead ] = head.step(word, token);
      
      didRead && (token = tokenizer.next().value);
    }
    
    head && doLog && console.log(inspect(head.value.root, { colors: true, depth: null }));
    
    return head ? head.value.root as InstanceType<Stc> : token;
  }
}
