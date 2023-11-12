export class SrcPosition {
  constructor(
    public line: number,
    public col: number,
    public i: number,
  ) {}
  
  toString(includeIndex = false) {
    return `${this.line}:${this.col}${includeIndex ? `::${this.i}` : ''}`;
  }
}

export type WithRange = {
  start: SrcPosition;
  end: SrcPosition;
};

export class SrcRange implements WithRange {
  constructor(
    public start: SrcPosition,
    public end: SrcPosition,
  ) {}
  
  static toString(range: WithRange, includeIndex = false) {
    const start = range.start.toString(includeIndex);
    const end = range.end.toString(includeIndex);
    
    return `${start} - ${end}`;
  }
  
  toString() {
    return SrcRange.toString(this);
  }
}

export class Token<Kind extends string | null> implements WithRange {
  constructor(
    // Null means end of input.
    public kind: Kind,
    public start: SrcPosition,
    public end: SrcPosition,
  ) {}
  
  traverse<T>(this: T, fn: (node: T) => boolean | void) {
    fn(this);
  }
  
  toString() {
    return `"${this.kind}" at ${SrcRange.toString(this)}`;
  }
}

export class TokenizationError {
  constructor(
    public at: SrcPosition,
  ) {}
}
