export function safeCast<T>(value: unknown, cls: new (...args: any[]) => T) {
  expect(value).toBeInstanceOf(cls);
  
  return value as T;
}
