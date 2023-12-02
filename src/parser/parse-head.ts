import { ReducedParserState } from "./table/reduced-table.js";
import { Token } from "../token.js";
import { isTerminal, MatchType } from "../grammar.js";
import { isSyntaxTreeClass, SyntaxTreeNode } from "#pattern";

type FullyMatched =
  | Token<string>
  | Token<string>[]
  | SyntaxTreeNode
  | SyntaxTreeNode[]
  ;

type PartlyMatched = Record<string, FullyMatched | FullyMatched[]>;

const mergePartlyMatched = (dest: PartlyMatched, src: PartlyMatched) => {
  // It is guaranteed by the grammar that if a property is in both
  // `dest` and `src`, then both values are arrays. (Otherwise,
  // `CompositePattern.getFields` would have thrown an error.)
  for (const key of Object.keys(src)) {
    dest[key] = key in dest
      ? [ ...(dest[key] as any), ...src[key] as Array<any> ]
      : src[key]
    ;
  }
};

function takeNHeads(
  head: ParseHead,
  count: number,
):
  [ ParseHead, PartlyMatched, Token<string>[] ]
{
  if (count === 0) return [ head, {}, [] ];
  
  // "nth last" using zero based indexing, as is, of course, proper.
  const [ nthLastHead, value, tokens ] = takeNHeads(head.previous!, count - 1);
  
  mergePartlyMatched(value, head.value);
  
  head.tokens.forEach(token => tokens.push(token));
  
  return [ nthLastHead, value, tokens ];
}

export class ParseHead {
  constructor(
    public previous: ParseHead | null,
    public state: ReducedParserState,
    // A list of tokens that were read to get to this state,
    // excluding those read up to the previous state.
    public tokens: Token<string>[],
    // Matched values so far.
    public value: PartlyMatched,
  ) {
  }
  
  // Returns [ newParseHead, didReadToken, expectedTokenKinds ].
  step(token: Token<string | null>):
    | [ ParseHead, boolean, null ]
    | [ null, false, (string | null)[] ] {
    const action = this.state.actions.get(token.kind);
    
    // If there is no action, we have a parse error.
    if (!action) {
      const expectedTokenKinds = [ ...this.state.actions.keys() ]
        .filter(isTerminal)
      
      return [ null, false, expectedTokenKinds ];
    }
    
    // Read action.
    if (action instanceof ReducedParserState) {
      // We don't ever read the end of input token.
      const newHead = new ParseHead(this, action, [ token as Token<string> ], {});
      
      return [ newHead, true, null ];
    }
    
    // Reduce action.
    let [ nthLastHead, value, tokens ] = takeNHeads(this, action.popCount);
    
    if (action.prop !== null) {
      const toInsert = isSyntaxTreeClass(action.match)
        ? (action.match.hidden ? value.value : new action.match(value))
        : action.match === MatchType.token
          ? tokens[0]
          : tokens
      ;
      
      isSyntaxTreeClass(action.match) && (value = {});
      
      if (action.isArrayMatch) {
        action.prop in value || (value[action.prop] = []);
        
        // If matching a hidden array-capturing class
        if (isSyntaxTreeClass(action.match) && action.match.hidden && action.match.fields.value) {
          (toInsert as Array<any>).forEach(val => (value[action.prop] as Array<any>).push(val));
        } else {
          (value[action.prop] as Array<any>).push(toInsert);
        }
      } else {
        value[action.prop] = toInsert;
      }
    }
    
    const newHead = new ParseHead(
      nthLastHead,
      nthLastHead.state.actions.get(action.reduceInto) as ReducedParserState,
      tokens,
      value,
    );
    
    return [ newHead, false, null ];
  }
}