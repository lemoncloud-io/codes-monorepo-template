/**
 * `yml.ts`
 * - transformer view to model
 *
 * @author      Steve <steve@lemoncloud.io>
 * @date        2022-06-21 optimized w/ `abstract-services`
 *
 * @copyright (C) 2022 LemonCloud Co Ltd. - All Rights Reserved.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import YAML from "js-yaml";

/** get error message from any error object */
export const GETERR = (e: any) =>
    e instanceof Error ? `${e.message}` : e && typeof e == 'object' ? JSON.stringify(e) : `${e}`;

/** convert any json to yml */
export const asYml = <T extends object>(N: T): string => {
  if (!N) return "";
  // return YAML.stringify(N);
  return YAML.dump(N, { lineWidth: -1 });
};

/** convert any json to yml with defined values only */
export const fromYml = <T extends object>(yml: string): T => {
  if (!yml) return {} as T;
  try {
    // return J2Y.parse(yml) as T;
    return YAML.load(yml) as T;
  } catch (e) {
    return { error: GETERR(e) } as T;
  }
};
