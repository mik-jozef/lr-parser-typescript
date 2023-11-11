import { Pattern } from "./index.js";
import { Token } from "../token.js";


export type SyntaxTreeClass = {
  new (...args: any[]): SyntaxTreeNode & { value?: unknown};
  name: string;
  rule: Pattern;
  fields: Record<string, boolean>;
  hidden: boolean;
};

export const isSyntaxTreeClass = (value: unknown): value is SyntaxTreeClass => {
  return typeof value === 'function' && value.prototype instanceof SyntaxTreeNode;
}

export type RawNode = Record<string, SyntaxTreeNode | SyntaxTreeNode[]>;

export abstract class SyntaxTreeNode {
  static hidden = false;
  
  static rule: Pattern;
  
  // A map from property names to whether they are arrays.
  static fields: Record<string, boolean>;
  
  parent: SyntaxTreeNode | null = null;
  
  private addChildNodes(obj: RawNode) {
    Object.assign(this, obj);
    
    const setParent = (child: unknown, parent: SyntaxTreeNode) => {
      child instanceof SyntaxTreeNode && (child.parent = parent);
    };
    
    (Object.keys(this) as (keyof this)[])
      .forEach(key => Array.isArray(this[key])
        ? (this[key] as any).forEach((val: unknown) => setParent(val, this))
        : setParent(this[key], this),
      );
  }
  
  private addNonmatchedFields() {
    const fields = (this.constructor as SyntaxTreeClass).fields;
    const fieldKeys = Object.keys(fields) as (string & keyof typeof this)[];
    
    fieldKeys.forEach(key => {
      if (!(key in this)) {
        (this[key] as any) = fields[key] ? [] : null;
      }
    });
  }
  
  constructor(obj: RawNode) {
    this.addChildNodes(obj);
    
    this.addNonmatchedFields();
  }
  
  traverse(fn: (node: SyntaxTreeNode | Token<string>) => boolean | void) {
    const visitChildren = fn(this);
    
    visitChildren && Object.keys(this).forEach(key => {
      if (key === 'parent') return;
      
      const value = this[key as never] as unknown;
      
      (value instanceof SyntaxTreeNode || value instanceof Token) &&
      value.traverse(fn);
    });
  }
}
