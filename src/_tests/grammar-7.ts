import { Caten, Match, MatchArr, SyntaxTreeNode } from "#pattern";
import { LogLevel } from "../parser/table/generate-table.js";
import { Parser } from "../parser/parser.js";
import { Token } from "../token";


export class Child extends SyntaxTreeNode {
  static hidden = true as true;
  
  static pattern = new Match('value', 'c');
}

export class ArrChild extends SyntaxTreeNode {
  static hidden = true as true;
  
  static pattern = new Caten(
    new MatchArr('value', 'a'),
    new MatchArr('value', 'a'),
  );
}

export class Parent extends SyntaxTreeNode {
  child!: Token<'c'>;
  childArr!: Token<'c'>[];
  arrChildren!: Token<'a'>[];
  
  static pattern: Caten = new Caten(
    new Match('child', Child),
    new MatchArr('childArr', Child),
    new MatchArr('arrChildren', ArrChild),
    new MatchArr('arrChildren', 'd'),
    new MatchArr('arrChildren', new Caten('e')),
  );
}

export const parser = new Parser(Parent, {
  logLevel: LogLevel.none,
});
