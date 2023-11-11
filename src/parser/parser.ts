import { promises as fs } from "fs";

import { SrcPosition, Token, TokenizationError } from "../token.js";
import { Match, SyntaxTreeClass } from "#pattern";
import { ParserTable } from "./table/parser-table.js";
import { ReducedParserState } from "./table/reduced-table.js";
import { deserializeTable, SerializedParserTable, serializeTable } from "./table/serialization.js";
import { generateTable, LogLevel } from "./table/generate-table.js";
import { ParseHead } from "./parse-head.js";


export class ParseError {
  constructor(
    public token: Token<string | null>,
    public expected: (string | null)[],
  ) {}
  
  toString() {
    const expected = this.expected.map(tokenKind => tokenKind ?? '(end of input)');
    
    return `Parse error at ${this.token}, expected one of: ${expected.join(', ')}.`;
  }
}

export type Tokenizer = (str: string) => Iterator<Token<string>, Token<null> | TokenizationError>;

export class Parser<Stc extends SyntaxTreeClass> {
  tokenizer: Tokenizer;
  
  private initialState: ReducedParserState;
  
  // The parser table is only stored in case it was generated on
  // the fly. If `serializedParserTable` is provided, this is null.
  private table: ParserTable | null = null;
  
  constructor(
    public stc: Stc,
    {
      tokenizer = null,
      serializedParserTable = null,
      logLevel = null,
    }: {
      tokenizer?: Tokenizer | null,
      serializedParserTable?: SerializedParserTable | null,
      logLevel?: LogLevel | null,
    } = {},
  ) {
    const hasNoExplicitLogLevel = logLevel === null;
    
    // Had to inline `hasNoExplicitLogLevel` because TS would think `logLevel` might continue being null.
    if (logLevel === null) logLevel = LogLevel.problemsOnly;
    
    if (logLevel !== LogLevel.none && tokenizer === null) {
      console.log(
        'lr-parser-typescript: no tokenizer provided. The default tokenizer will be used. The default tokenizer makes each letter of the parsed word into its own token. This means the grammar should only use single-letter strings as patterns, as longer strings will never be matched.\n' +
        'Example: with the default tokenizer, `new Caten(\'l\', \'e\', \'t\')` matches the string "let", but `new Caten(\'let\')` does not!\n' +
        'For a more complex tokenization, provide your own tokenizer.',
      );
    }
    
    this.tokenizer = tokenizer ?? Parser.defaultTokenizer;
    
    const stcs = new Match('unused', stc).collectSyntaxTreeClasses();
    
    if (serializedParserTable !== null) {
      this.initialState = deserializeTable(stcs, serializedParserTable);
      
      return;
    }
    
    if (logLevel !== LogLevel.none) {
      const msg = 'lr-parser-typescript: `serializedParserTable` not provided to a Parser instance. The parser table will be generated on the fly. This is fine for development, but is inefficient as the table is generated every time a program is run. See the docs for how to generate the parser table statically.';
      
      if (hasNoExplicitLogLevel) {
        console.log(
          `${msg} (Current log level is "${LogLevel.problemsOnly}", by default. To disable logging completely, set \`logLevel\` to \`LogLevel.none\`.)\n`,
        );
      } else {
        console.log(`${msg}\n`);
      }
    }

    this.table = generateTable(stc, logLevel);
    
    this.initialState = deserializeTable(stcs, serializeTable(this.table));
  }
  
  saveParserTable(path: string) {
    if (this.table === null) {
      throw new Error(
        'lr-parser-typescript: Cannot save the parser table because it was loaded using `serializedParserTable`. ' +
        'Only parser tables generated on the fly can be saved.',
      );
    }
    
    return fs.writeFile(path,
      JSON.stringify(serializeTable(this.table)),
    );
  }
  
  // SyntaxTreeNode - successfully parsed.
  // Token - parse error at token.
  // null - parse error at end of input.
  parse(word: string):
    | Stc['hidden'] extends true ? InstanceType<Stc>['value'] : InstanceType<Stc>
    | TokenizationError
    | ParseError
  {
    const tokenizer = this.tokenizer(word);
    
    let head: ParseHead | null = new ParseHead(null, this.initialState, [], {});
    let token = tokenizer.next().value;
    
    for (; head && !head.state.isAccepting;) {
      if (token instanceof TokenizationError) return token;
      
      let didRead, expectedTokenKinds;
      
      [ head, didRead, expectedTokenKinds ] = head.step(token);
      
      if (!head) return new ParseError(token, expectedTokenKinds!);
      
      didRead && (token = tokenizer.next().value);
    }
    
    return head.value.root as InstanceType<Stc>;
  }
  
  static *defaultTokenizer(str: string) {
    let col = 0;
    let row = 0;
    
    for (const [ i, ch ] of [...str].entries()) {
      yield new Token(
        ch,
        new SrcPosition(row, col, i),
        new SrcPosition(row, col + 1, i + 1),
      );
      
      if (ch === '\n') {
        col = 0;
        row += 1;
      } else {
        col += 1;
      }
    }
    
    return new Token(
      null,
      new SrcPosition(row, col, str.length),
      new SrcPosition(row, col, str.length),
    );
  }
}
