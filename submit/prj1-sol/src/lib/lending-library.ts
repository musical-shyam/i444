import { Errors } from 'cs544-js-utils';
import { errResult } from 'cs544-js-utils/dist/lib/errors';
import { argv0 } from 'process';

/** Note that errors are documented using the `code` option which must be
 *  returned (the `message` can be any suitable string which describes
 *  the error as specifically as possible).  Whenever possible, the
 *  error should also contain a `widget` option specifying the widget
 *  responsible for the error).
 *
 *  Note also that none of the function implementations should normally
 *  require a sequential scan over all books or patrons.
 */

/******************** Types for Validated Requests *********************/

/** used as an ID for a book */
type ISBN = string; 

/** used as an ID for a library patron */
type PatronId = string;

export type Book = {
  isbn: ISBN;
  title: string;
  authors: string[];
  pages: number;      //must be int > 0
  year: number;       //must be int > 0
  publisher: string;
  nCopies?: number;   //# of copies owned by library; not affected by borrows;
                      //must be int > 0; defaults to 1
};

export type XBook = Required<Book>;

type AddBookReq = Book;
type FindBooksReq = { search: string; };
type ReturnBookReq = { patronId: PatronId; isbn: ISBN; };
type CheckoutBookReq = { patronId: PatronId; isbn: ISBN; };

/************************ Main Implementation **************************/

export function makeLendingLibrary() {
  return new LendingLibrary();
}

export class LendingLibrary {

  //TODO: declare private TS properties for instance
  private books : Record<ISBN, XBook>; //a dictionary of books
  private bookPatron: Record<ISBN, PatronId[]>; // stores Patron that took a particular book
  private patronArray: Record<PatronId, ISBN[]>; // stores the books that a patron has taken
  private find: Record<string, ISBN[]>; // stores an array of bookId where a word has occured
  
  constructor() {
    //TODO: initialize private TS properties for instance
    this.books = {};//all are empty dictionaries intially
    this.bookPatron = {};
    this.patronArray = {};
    this.find ={};
  }

  /** Add one-or-more copies of book represented by req to this library.
   *
   *  Errors:
   *    MISSING: one-or-more of the required fields is missing.
   *    BAD_TYPE: one-or-more fields have the incorrect type.
   *    BAD_REQ: other issues like nCopies not a positive integer 
   *             or book is already in library but data in obj is 
   *             inconsistent with the data already present.
   */
  addBook(req: Record<string, any>): Errors.Result<XBook> {
    //TODO
    const reqFields = ['isbn', 'title', 'authors', 'pages', 'year', 'publisher'];//as all keys in dict are string
    for(const x of reqFields){//using the for loop to check if all the required field are their
      if(req[x] === undefined){
        return Errors.errResult(': property ${x} is required; widget=', 'MISSING',x);
      }
    }
    if (typeof req.isbn !== 'string'){
      return Errors.errResult(': property ${x} must be string, widget=','BAD_TYPE', 'isbn');
    }
    else if (typeof req.title !== 'string'){
      return Errors.errResult(': property ${x} must be string, widget=','BAD_TYPE', 'title');
    } 
    else if (!Array.isArray(req.authors) || req.authors.some(author => typeof author !== 'string')){
      return Errors.errResult(': property ${x} must be type string[]; widget=','BAD_TYPE', 'authors');
    } 
    else if(req.authors.length === 0){
      return Errors.errResult(': property ${x} is empty; widget=','BAD_TYPE', 'authors');
    }
    else if (typeof req.publisher !== 'string') {
      return Errors.errResult(': property ${x} must be string; widget=','BAD_TYPE', 'publisher');
    } 
    if (req["nCopies"] === undefined) {
      req['nCopies'] = 1;
    }
    const NUMERIC_FIELDS = [ 'pages', 'year', 'nCopies' ];
    for (const x of NUMERIC_FIELDS){
      if (typeof req[x] !== 'number'){
        return Errors.errResult(': property ${x} must be numeric; widget=','BAD_TYPE', x);
      }
      if(req[x] < 1 || !Number.isInteger(req[x])){
        return Errors.errResult(': property ${x} must be greater than 0, widget=','BAD_REQ', x);
      }
    }
    this.books[req['isbn']] = req as XBook;
    return Errors.okResult(this.books[req.isbn]);//placeholder
  }

  /** Return all books matching (case-insensitive) all "words" in
   *  req.search, where a "word" is a max sequence of /\w/ of length > 1.
   *  Returned books should be sorted in ascending order by title.
   *
   *  Errors:
   *    MISSING: search field is missing
   *    BAD_TYPE: search field is not a string.
   *    BAD_REQ: no words in search
   */
  findBooks(req: Record<string, any>) : Errors.Result<XBook[]> {
    //TODO
    return Errors.errResult('TODO');  //placeholder
  }


  /** Set up patron req.patronId to check out book req.isbn. 
   * 
   *  Errors:
   *    MISSING: patronId or isbn field is missing
   *    BAD_TYPE: patronId or isbn field is not a string.
   *    BAD_REQ error on business rule violation.
   */
  checkoutBook(req: Record<string, any>) : Errors.Result<void> {
    //TODO
    return Errors.errResult('TODO');  //placeholder
  }

  /** Set up patron req.patronId to returns book req.isbn.
   *  
   *  Errors:
   *    MISSING: patronId or isbn field is missing
   *    BAD_TYPE: patronId or isbn field is not a string.
   *    BAD_REQ error on business rule violation.
   */
  returnBook(req: Record<string, any>) : Errors.Result<void> {
    //TODO 
    return Errors.errResult('TODO');  //placeholder
  }
  
}


/********************** Domain Utility Functions ***********************/


//TODO: add domain-specific utility functions or classes.

/********************* General Utility Functions ***********************/

//TODO: add general utility functions or classes.
function Missing(){

}
