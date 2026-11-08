export type Ok<Type> = {
  ok: true;
  value: Type;
};

export type Fail<Type> = {
  ok: false;
  error: Type;
};

export type Result<Type, Error extends string> = Ok<Type> | Fail<Error>;

export const ok = <Type>(value: Type): Ok<Type> => ({ ok: true, value });
export const fail = <Error extends string>(error: Error): Fail<Error> => ({ ok: false, error });
