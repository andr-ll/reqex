/*!
 * @author Andrii Lytovchenko <andr.lyt.dev@gmail.com>
 * @license MIT
 */

import { Request } from './request';
import { Method } from './types';

export class Reqex {
  /**
   * GET request.
   */
  get(url: string) {
    return new Request(url, Method.GET);
  }

  /**
   * POST request.
   */
  post(url: string) {
    return new Request(url, Method.POST);
  }

  /**
   * PUT request.
   */
  put(url: string) {
    return new Request(url, Method.PUT);
  }

  /**
   * DELETE request.
   */
  delete(url: string) {
    return new Request(url, Method.DELETE);
  }
}

export const reqex = new Reqex();
