import { Constructor, Context, Grammar, GrammarSymbol, Nonterminal } from "../../grammar.js";

/*/
  Computes the zeroth set (called the "first" set by the one-based-indexing
  people) of a grammar rule.
/*/
export const getZerothOfSequence = (
  alreadyKnownZeroths: Map<Nonterminal, Context>,
  sequence: GrammarSymbol[],
  follow: Context = new Set([ null ]),
  i = 0,
): Context => {
  const context: Context = new Set();
  
  for (; i < sequence.length; i++) {
    const grammarSymbol = sequence[i];
    
    if (typeof grammarSymbol === 'string') {
      context.add(grammarSymbol);
      
      return context;
    }
    
    const hereContext = alreadyKnownZeroths.get(grammarSymbol)!;
    const hereCanBeEmpty = hereContext.has(null);
    
    hereContext.forEach(s => s === null || context.add(s));
    
    if (!hereCanBeEmpty) return context;
  }
  
  follow.forEach(symbol => context.add(symbol))
  
  return context;
}

/*/
  Computes the zeroth sets of the grammar.
/*/
export const computeZeroth = <T0, T1 extends Constructor>(grammar: Grammar<T0, T1>) => {
  let change = true;
  
  while (change) {
    change = false;
    
    for (const { head, expansion } of grammar.rules) {
      const oldContext = grammar.zerothSets.get(head)!;
      const newContext = getZerothOfSequence(grammar.zerothSets, expansion);
      
      oldContext.forEach(s => newContext.add(s));
      
      if (oldContext.size < newContext.size) {
        change = true;
        
        grammar.zerothSets.set(head, newContext);
      }
    }
  }
};
