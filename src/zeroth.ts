import { GrammarSymbol, Grammar, Context, Nonterminal } from "./parser.js";
import { TokenKind } from "./tokenizer.js";


export function getZerothOfRule(
  alreadyKnownZeroths: Map<Nonterminal, Context>,
  rule: GrammarSymbol[],
  follow: Context = new Set([ null ]),
  i = 0,
): Context {
  const context: Context = new Set();
  
  let canBeEmpty = true;
  
  for (; i < rule.length; i++) {
    const grammarSymbol = rule[i];
    
    if (grammarSymbol instanceof TokenKind) {
      context.add(grammarSymbol);
      canBeEmpty = false;
    } else {
      const hereContext = alreadyKnownZeroths.get(grammarSymbol)!;
      const hereCanBeEmpty = hereContext.has(null);
      
      hereContext.forEach(c => c && context.add(c));
      canBeEmpty = hereCanBeEmpty;
    }
    
    if (!canBeEmpty) return context;
  }
  
  follow.forEach(c => context.add(c))
  
  return context;
}

export function computeZeroth(grammar: Grammar) {
  let change = true;
  
  while (change) {
    change = false;
    
    for (const { nt, expansion } of grammar.rules) {
      const oldContext = grammar.zerothSets.get(nt)!;
      const newContext = new Set([
        ...getZerothOfRule(grammar.zerothSets, expansion),
        ...oldContext,
      ]);
      
      if (oldContext.size < newContext.size) {
        change = true;
        
        grammar.zerothSets.set(nt, newContext);
      }
    }
  }
}
