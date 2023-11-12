import { Parser } from "../parser/parser.js";
import { Caten, Match, MatchArr, Maybe, Or, Repeat, SyntaxTreeNode } from "#pattern";
import { LogLevel } from "../parser/table/generate-table.js";
import { Token } from "../token.js";
import { wordTokenizer } from "./word-tokenizer";


class LetDeclaration extends SyntaxTreeNode {
  static pattern = 'let';
}

export class HyloaImportAst extends SyntaxTreeNode {
  static pattern = 'import';
}

export class ModuleMember extends SyntaxTreeNode {
  isPrivate!: Token<'private'> | null;
  member!: LetDeclaration;
  
  static pattern = new Caten(
    new Maybe(
      new Match('isPrivate', 'private'),
    ),
    new Or(
      new Match('member', LetDeclaration),
    ),
  );
}

export class HyloaModuleAst extends SyntaxTreeNode {
  imports!: HyloaImportAst[];
  
  members!: ModuleMember[];
  
  static pattern = new Caten(
    new Repeat(
      new MatchArr('imports', HyloaImportAst),
    ),
    new Repeat(
      new MatchArr('members', ModuleMember),
    ),
  );
}

export const parser = new Parser(HyloaModuleAst, {
  logLevel: LogLevel.none,
  tokenizer: wordTokenizer,
});
