import { ReduceAction, ReducedParserState, ReduceMatchAction, ReduceNonmatchAction } from "./reduced-table.js";
import { MatchType } from "../../grammar.js";
import { isSyntaxTreeClass, PatternGrammar, SyntaxTreeClass } from "#pattern";
import { ParserTable } from "./parser-table.js";
import { ParserState } from "./parser-state.js";

export type SerializedAction = {
  read: boolean;
  index: number;
};

type SerializedTransition = {
  under: string | number | null;
  action: SerializedAction;
};

export type SerializedParserState = {
  isAccepting: boolean,
  transitions: SerializedTransition[];
};

type ReduceNonmatchInfo = {
  popCount: number;
  reduceInto: number;
  prop: null;
};

type ReduceMatchInfo = {
  popCount: number;
  reduceInto: number;
  prop: string;
  isArrayMatch: boolean;
  type:
    | [ 'class', string ]
    | [ 'pattern' ]
    | [ 'token' ]
  ;
};

type ReduceInfo = ReduceNonmatchInfo | ReduceMatchInfo;

export type SerializedParserTable = {
  states: SerializedParserState[];
  reduceInfos: Record<number, ReduceInfo>;
};

const deserializeReduceAction = (
  stcs: Map<string, SyntaxTreeClass>,
  action: ReduceInfo,
): ReduceAction => {
  if (action.prop === null) {
    return new ReduceNonmatchAction(action.popCount, action.reduceInto);
  }
  
  return new ReduceMatchAction(
    action.popCount,
    action.reduceInto,
    action.prop,
    action.isArrayMatch,
    action.type[0] === 'class'
      ? stcs.get(action.type[1])!
      : action.type[0] === 'pattern'
      ? MatchType.pattern
      : MatchType.token,
  );
}

// Returns the initial state of the parser.
export const deserializeTable = (
  stcs: Map<string, SyntaxTreeClass>,
  serialized: SerializedParserTable,
): ReducedParserState => {
  const states = serialized.states.map(
    (state) => new ReducedParserState(state.isAccepting),
  );
  
  const reduceActions = new Map<number, ReduceAction>(
    Object.entries(serialized.reduceInfos).map(([ index, reduceInfo ]) => {
      const parsedIndex = parseInt(index);
      
      return [
        parsedIndex,
        deserializeReduceAction(stcs, reduceInfo),
      ];
    }),
  );
  
  for (const [ i, state ] of states.entries()) {
    for (const transition of serialized.states[i].transitions) {
      const { under, action } = transition;
      
      if (action.read) {
        state.actions.set(under, states[action.index]);
      } else {
        state.actions.set(under, reduceActions.get(action.index)!);
      }
    }
  }
  
  return states[0];
}


const createReduceInfos = (
  grammar: PatternGrammar,
) => {
  const reduceInfos: Record<number, ReduceInfo> = {};
  
  for (const grammarRule of grammar.rules) {
    const matchInfo = grammar.nonterminalMatchInfos.get(grammarRule.head);
    
    if (!matchInfo) {
      reduceInfos[grammarRule.index] = {
        popCount: grammarRule.expansion.length,
        reduceInto: grammarRule.head,
        prop: null,
      };
      
      continue;
    }
    
    let type: ReduceMatchInfo['type'];
    
    switch (true) {
      case isSyntaxTreeClass(matchInfo.match):
        type = [ 'class', (matchInfo.match as SyntaxTreeClass).name ];
        break;
      
      case matchInfo.match === MatchType.pattern:
        type = [ 'pattern' ];
        break;
      
      case matchInfo.match === MatchType.token:
        type = [ 'token' ];
        break;
      
      default:
        throw new Error(`Unknown match type: ${matchInfo.match}`);
    }
    
    reduceInfos[grammarRule.index] = {
      popCount: grammarRule.expansion.length,
      reduceInto: grammarRule.head,
      prop: matchInfo.prop,
      isArrayMatch: matchInfo.isArrayMatch,
      type,
    };
  }
  
  return reduceInfos;
}

export const serializeTable = (table: ParserTable): SerializedParserTable => {
  const states = table.states.map(
    (state) => ({
      isAccepting: state.isAccepting,
      transitions: [ ...state.actions ].map(([ under, action ]) => ({
        under,
        action: {
          read: action instanceof ParserState,
          index: action.index as number,
        },
      })),
    }),
  );
  
  const reduceInfos = createReduceInfos(table.grammar);
  
  return { states, reduceInfos };
}