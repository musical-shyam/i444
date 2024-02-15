import { Errors } from 'cs544-js-utils';
import { errResult } from 'cs544-js-utils/dist/lib/errors';
import { argv0 } from 'process';
import { isBigInt64Array } from 'util/types';

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
    if(this.books[req['isbn']]){
      const AddBookReq: Record<string, any> = this.books[req.isbn];
      for(const x of reqFields){
        if(req[x] !== AddBookReq[x]){
          return Errors.errResult(': inconsistent ${x} data for book ${AddBookReq.isbn}; widget=', 'BAD_REQ',x);
        }
      }
      this.books[req['isbn']].nCopies += req.nCopies;
      return Errors.okResult(this.books[req.isbn]);
    }
    this.searchWord(req);
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
    if(req === undefined){
      return Errors.errResult(': property search is required; widget=', "MISSING","=search");
    }
    else if (typeof req.search !== 'string' ){
      return Errors.errResult(': property search must be string; widget=','BAD_TYPE','=search');
    }
    const words = req.search.toLowerCase().match(/\w{2,}/g);
    if(!words||words.length === 0||req.search.trim()===''){
      return Errors.errResult(': property search should not be empty; widget=','BAD_REQ','=search');
    }
    let isbns = words.map(word => this.find[word] || []).reduce((acc, cur) => acc.length ?acc.filter(isbn => cur.includes(isbn)) : cur, []);

    // Find books by ISBNs and sort by title
    const books = isbns.map(isbn => this.books[isbn]).sort((a, b) => a.title.localeCompare(b.title));

    // Return results
    if (books.length) {
      return Errors.okResult(books);
    } 
    return Errors.okResult([]);  //placeholder
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
    if(req.patronId === undefined){
      return Errors.errResult(': property patronId is required; widget=', "MISSING",'=patronId');
    }
    else if(req.isbn === undefined){
      return Errors.errResult(': property isbn is required; widget=', "MISSING",'=isbn');
    }
    else if (typeof req.patronId !== 'string'){
      return Errors.errResult(': property patronId must be string; widget=','BAD_TYPE','=patronId');
    }
    else if (typeof req.isbn !== 'string'){
      return Errors.errResult(': property isbn must be string; widget=','BAD_TYPE','=isbn');
    }
    if(!this.books[req.isbn]){
      return Errors.errResult('unknown book ${req.isbn}; widget=', "BAD_REQ", 'isbn')
    }
    else if(this.patronArray[req.patron] && this.patronArray[req.patron].includes(req.isbn)){
      return Errors.errResult('patron ${req.patronId} already has book ${req.isbn} checked out; widget=', "BAD_REQ", 'isbn');
    }
    else if (this.books[req.isbn].nCopies === 0) {
      // If nCopies is 0, return an error indicating no copies are available
      return Errors.errResult(': no copies of book ${req.isbn} are available for checkout; widget=', "BAD_REQ", 'isbn');
    }
    this.patronArray[req.patronId] = [req.isbn];
    this.bookPatron[req.isbn] = [req.patronId];
    this.books[req.isbn].nCopies--;
    return Errors.okResult(undefined);  //placeholder
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
    if(req.patronId === undefined){
      return Errors.errResult(': property patronId is required; widget=', "MISSING",'=patronId');
    }
    else if(req.isbn === undefined){
      return Errors.errResult(': property isbn is required; widget=', "MISSING",'=isbn');
    }
    else if (typeof req.patronId !== 'string'){
      return Errors.errResult(': property patronId must be string; widget=','BAD_TYPE','=patronId');
    }
    else if (typeof req.isbn !== 'string'){
      return Errors.errResult(': property isbn must be string; widget=','BAD_TYPE','=isbn');
    }
    if(!this.books[req.isbn]){
      return Errors.errResult('unknown book ${req.isbn}; widget=', "BAD_REQ", '=isbn')
    }
    else if(!this.patronArray[req.patron]){
      return Errors.errResult('unknown patron ${req.patronId}; widget=', "BAD_REQ", '=patronId');
    }
    else if(!this.patronArray[req.patron].includes(req.isbn)){
      return Errors.errResult('no checkout of book ${req.isbn} by patron ${req.patronId}', "BAD_REQ", 'isbn');
    }
    const patronBooksIndex = this.patronArray[req.patronId].indexOf(req.isbn);
    if (patronBooksIndex > -1) {
      this.patronArray[req.patronId].splice(patronBooksIndex, 1);
    }
    const bookPatronsIndex = this.bookPatron[req.isbn]?.indexOf(req.patronId);
    if (bookPatronsIndex > -1) {
      this.bookPatron[req.isbn].splice(bookPatronsIndex, 1);
    }
    this.books[req.isbn].nCopies++;
    return Errors.errResult(undefined);  //placeholder
  }


/********************** Domain Utility Functions ***********************/


//TODO: add domain-specific utility functions or classes.
  searchWord(req: Record<string, any>): void {
    const addWord = (word: string) => { const lowerWord = word.toLowerCase();
      if (!this.find[lowerWord]) {
        this.find[lowerWord] = [req['isbn']];
      } 
      else if (!this.find[lowerWord].includes(req['isbn'])) {
        this.find[lowerWord].push(req['isbn']);
      }
    };
    // using regex and addword function to divide each and every word
    req.title.match(/\w{2,}/g)?.forEach(addWord);

    // Tokenize and add authors words
    req.authors.forEach((author: string) => author.match(/\w{2,}/g)?.forEach(addWord));
  }
/********************* General Utility Functions ***********************/
}
//TODO: add general utility functions or classes.

