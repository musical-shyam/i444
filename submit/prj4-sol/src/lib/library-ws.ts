import { Errors } from 'cs544-js-utils';

import { SuccessEnvelope, PagedEnvelope, ErrorEnvelope }
  from './response-envelopes.js';
import * as Lib from 'library-types';

import * as Utils from './utils.js';


type NonPagedResult<T> = SuccessEnvelope<T> | ErrorEnvelope;
type PagedResult<T> = PagedEnvelope<T> | ErrorEnvelope;

export function makeLibraryWs(url: string) {
  return new LibraryWs(url);
}

export class LibraryWs {
  //base url for these web services
  private url;

  constructor(url: string) { this.url = url; }

  /** given an absolute books url bookUrl ending with /books/api,
   *  return a SuccessEnvelope for the book identified by bookUrl.
   */
  async getBookByUrl(bookUrl: URL|string)
    : Promise<Errors.Result<SuccessEnvelope<Lib.XBook>>>
  {
    return getEnvelope<Lib.XBook, SuccessEnvelope<Lib.XBook>>(bookUrl); 
    //return Errors.errResult('TODO');
  }

  /** given an absolute url findUrl ending with /books with query
   *  parameters search and optional query parameters count and index,
   *  return a PagedEnvelope containing a list of matching books.
   */
  async findBooksByUrl(findUrl: URL|string)
    : Promise<Errors.Result<PagedEnvelope<Lib.XBook>>>
  {
    return getEnvelope<Lib.XBook, PagedEnvelope<Lib.XBook>>(findUrl);
    //return Errors.errResult('TODO');
  }

  /** check out book specified by lend */
  //make a PUT request to /lendings
  async checkoutBook(lend: Lib.Lend) : Promise<Errors.Result<void>> {
    return this.sendBookRequest('/api/lendings', 'PUT', lend); //diverting to common method(check below)
  }

  /** return book specified by lend */
  //make a DELETE request to /lendings
  async returnBook(lend: Lib.Lend) : Promise<Errors.Result<void>> {
    return this.sendBookRequest('/api/lendings', 'DELETE', lend); // diverting to common method
  }

  /** return Lend[] of all lendings for isbn. */
  //make a GET request to /lendings with query-params set
  //to { findBy: 'isbn', isbn }.
  async getLends(isbn: string) : Promise<Errors.Result<Lib.Lend[]>> {
    const url = new URL(`${this.url}/api/lendings`);
    url.searchParams.set('findBy', 'isbn');
    url.searchParams.set('isbn', isbn);

    try {
        const response = await fetch(url.toString()); // Convert URL object to string for fetch
        const data = await response.json(); // Parse the JSON from the response

        if (!response.ok) {
            throw new Error(data?.message || 'Failed to fetch lendings');
        }

        if (data.isOk) {
            return Errors.okResult(data.result); // Assuming data.result contains the array of Lends
        } else {
            return new Errors.ErrResult(data.errors as Errors.Err[]); // Handling ErrorEnvelope
        }
    } catch (err) {
        console.error('Error fetching lending data:', err);
        return Errors.errResult(err); // Convert exceptions into an error result
    }
  }
  //the method for interacting with lend 
  //sends either put or delete request to /lendings
  private async sendBookRequest(endpoint: string, method: 'PUT' | 'DELETE', data: object): Promise<Errors.Result<void>> {
    const url = `${this.url}${endpoint}`;
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const responseData = await response.json();
        
        if (responseData.isOk) {
            return Errors.VOID_RESULT;
        } else {
            return new Errors.ErrResult(responseData.errors as Errors.Err[]);
        }
    } catch (error) {
        console.error(`${method} ${url}: error`, error);
        return Errors.errResult(error);
    }
}


}

/** Return either a SuccessEnvelope<T> or PagedEnvelope<T> wrapped 
 *  within a Errors.Result.  Note that the caller needs to instantiate
 *  both type parameters appropriately.
 */
async function getEnvelope<T, T1 extends SuccessEnvelope<T>|PagedEnvelope<T>>
  (url: URL|string)
  : Promise<Errors.Result<T1>>
{
  const result = await fetchJson<T1|ErrorEnvelope>(url);
  if (result.isOk === true) {
    const response = result.val;
    if (response.isOk === true) {
      return Errors.okResult(response);
    }
    else 
      return new Errors.ErrResult(response.errors as Errors.Err[]);
  }
  else {
    return result as Errors.Result<T1>;
  }
}

const DEFAULT_FETCH = { method: 'GET', };

/** send a request to url, converting any exceptions to an 
 *  error result.
 */
async function
  fetchJson<T>(url: URL|string,  options: RequestInit = DEFAULT_FETCH)
  : Promise<Errors.Result<T>> 
{
    //<https://github.com/microsoft/TypeScript/blob/main/src/lib/dom.generated.d.ts#L26104>
  try {
    const response = await fetch(url, options);
    return Errors.okResult(await response.json() as T);
  }
  catch (err) {
    console.error(err);
    return Errors.errResult(`${options.method} ${url}: error ${err}`);
  }
}

//TODO: add other functions as needed
