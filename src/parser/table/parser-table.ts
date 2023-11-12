import { ParserState } from "./parser-state.js";
import { PatternGrammar } from "#pattern";


export class ParserTable {
  states: ParserState[] = [];
  
  // When a state generates its successor state, it creates the state
  // with an empty action table, and then checks if the successor state
  // is compatible with any existing state. If it is, the successor
  // state is merged into the existing state.
  // 
  // If the existing state is already populated, we need to regenerate
  // its actions. We can't do that using recursion, because that could
  // cause a stack overflow. Instead, we add the existing state to this
  // set, and regenerate its actions (including its successors,
  // transitively) while iterating over this set.
  private statesToRegenerate = new Set<ParserState>();
  
  constructor(
    public grammar: PatternGrammar,
    public doLog: boolean,
  ) {}
  
  insert(state: ParserState) {
    const foundState = this.states.find(s => ParserState.isWeaklyCompatible(s, state));
    
    // Merge states according to the Pager's algorithm [0].
    if (foundState) {
      let didModifyState = false;
      
      for (const [ i, ruleAt ] of state.ruleAts.entries()) {
        ruleAt.follow.forEach(symbol => {
          if (foundState.ruleAts[i].follow.has(symbol)) return;
          
          foundState.ruleAts[i].follow.add(symbol);
          didModifyState = true;
        });
      }
      
      // Instead of always regenerating the actions, we could apply
      // some procedure from [0] to update them (in most cases).
      // I decided to skip the thinking required for figuring out
      // how that works and then implementing it, so I just
      // regenerate them every time.
      //
      // [0]: https://sci-hub.se/https://doi.org/10.1007/BF00290336
      didModifyState && foundState.isPopulated() &&
        this.statesToRegenerate.add(foundState);
      
      return foundState;
    }
    
    state.index = this.states.length;
    this.states.push(state);
    
    this.states.length % 128 === 0 && this.doLog &&
    console.log(`Generated ${this.states.length} states.`);
    
    return state;
  }
  
  // I suppose a state can become unreachable if a state is merged
  // into its predecessor and then the predecessor's actions are
  // regenerated.
  removeUnreachable() {
    const reachableStates = new Set([ this.states[0] ]);
    
    let lastSize = 0;
    
    while (reachableStates.size !== lastSize) {
      lastSize = reachableStates.size;
      
      reachableStates.forEach(state => {
        for (const [ , action ] of state.actions) {
          action instanceof ParserState && reachableStates.add(action);
        }
      });
    }
    
    this.states = this.states.filter(state => reachableStates.has(state));
    
    this.states.forEach((state, index) => state.index = index);
  }
  
  generateStates() {
    for (let i = 0; i < this.states.length; i++) {
      const maybeConflict = this.states[i].addStates(this);
      
      if (maybeConflict) return maybeConflict;
      
      for (const state of this.statesToRegenerate) {
        const maybeConflict = state.addStates(this);
        
        if (maybeConflict) return maybeConflict;
      }
      
      this.statesToRegenerate.clear();
    }
    
    this.removeUnreachable();
    
    return null;
  }
}
