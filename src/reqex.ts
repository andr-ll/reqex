/*!
 * @author Andrii Lytovchenko <andr.lyt.dev@gmail.com>
 * @license MIT
 */

import nuti from 'nuti';
import { Request } from './request';
import { Method } from './types';

export class Reqex {
  private logger = nuti.makeLogger();

  /**
   * GET request.
   * @returns an object of specified interface (for TS only).
   */
  get(url: string) {
    return new Request(url, Method.GET, this.logger);
  }

  /**
   * POST request.
   * @param body Any object.
   * @returns an object of specified interface (for TS only).
   */
  post(url: string) {
    return new Request(url, Method.POST, this.logger);
  }

  /**
   * PUT request.
   * @param body Any object.
   * @returns an object of specified interface (for TS only).
   */
  put(url: string) {
    return new Request(url, Method.PUT, this.logger);
  }

  /**
   * DELETE request.
   * @param body Any object.
   * @returns an object of specified interface (for TS only).
   */
  delete(url: string) {
    return new Request(url, Method.DELETE, this.logger);
  }
}

export const reqex = new Reqex();
