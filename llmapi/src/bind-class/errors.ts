export class ModelNotInstalledError extends Error {
  constructor(msg?: string) { super(msg); this.name = 'ModelNotInstalledError'; }
}
export class NoActiveModelError extends Error {
  constructor(msg?: string) { super(msg); this.name = 'NoActiveModelError'; }
}
export class NoModelBindError extends Error {
  constructor(msg?: string) { super(msg); this.name = 'NoModelBindError'; }
}
export class BindNotFoundError extends Error {
  constructor(msg?: string) { super(msg); this.name = 'BindNotFoundError'; }
}
