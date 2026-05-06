export type DirectusSchema<T extends Record<string, any>> = {
  [K in keyof T as K extends `Items${infer Name}`
    ? Lowercase<Name>
    : never]: T[K][]
}
