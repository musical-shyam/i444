import { Errors } from 'cs544-js-utils';


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

  addBook(req: Record<string, any>): Errors.Result<XBook> {
    //as all keys in dict are string
    const reqFields = ['isbn', 'title', 'authors', 'pages', 'year', 'publisher'];
    //using the for loop to check if all the required field are present
    for(const x of reqFields){
      if(req[x] === undefined){
        return Errors.errResult(': property ${x} is required; widget=', 'MISSING',x);
      }
    }
    //checking for the required type of the field and if all numbers are greater than 0
    const String_Fields = ['isbn', 'title', 'publisher'];
    for (const x of String_Fields){
      if (typeof req[x] !== 'string'){
        return Errors.errResult(': property ${x} must be string; widget=','BAD_TYPE', x);
      }
    }
    if (!Array.isArray(req.authors) || req.authors.some(author => typeof author !== 'string')){
      return Errors.errResult(': property ${x} must be type string[]; widget=','BAD_TYPE', 'authors');
    } 
    else if(req.authors.length === 0){
      return Errors.errResult(': property ${x} is empty; widget=','BAD_TYPE', 'authors');
    }
    if (req["nCopies"] === undefined) {
      req['nCopies'] = 1;
    }
    const Numeric_Fields = [ 'pages', 'year', 'nCopies' ];
    for (const x of Numeric_Fields){
      if (typeof req[x] !== 'number'){
        return Errors.errResult(': property ${x} must be numeric; widget=','BAD_TYPE', x);
      }
      if(req[x] < 1 || !Number.isInteger(req[x])){
        return Errors.errResult(': property ${x} must be greater than 0, widget=','BAD_REQ', x);
      }
    }
    //checking if book exists, if exists and if same details, no of copies increases
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
    //adding all the word to the collection of the words
    this.wordCollection(req);
    this.books[req['isbn']] = req as XBook;
    return Errors.okResult(this.books[req.isbn]);
  }

  findBooks(req: Record<string, any>) : Errors.Result<XBook[]> {
    //check the parameters
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
    return Errors.okResult([]); 
  }

  checkoutBook(req: CheckoutBookReq) : Errors.Result<void> {
    if(req.patronId === undefined){
      return Errors.errResult(': property patronId is required; widget=', "MISSING",'patronId');
    }
    else if(req.isbn === undefined){
      return Errors.errResult(': property isbn is required; widget=', "MISSING",'isbn');
    }
    else if (typeof req.patronId !== 'string'){
      return Errors.errResult(': property patronId must be string; widget=','BAD_TYPE','patronId');
    }
    else if (typeof req.isbn !== 'string'){
      return Errors.errResult(': property isbn must be string; widget=','BAD_TYPE','isbn');
    }
    //errors on bad book
    if(!this.books[req.isbn]){
      return Errors.errResult('unknown book ${req.isbn}; widget=', "BAD_REQ", 'isbn')
    }
    this.bookPatron[req.isbn] = this.bookPatron[req.isbn] || [];
    this.patronArray[req.patronId] = this.patronArray[req.patronId] || [];

    //errors on multiple checkout of same book by same patron
    if(this.patronArray[req.patronId].includes(req.isbn)){
      return Errors.errResult('patron ${req.patronId} already has book ${req.isbn} checked out; widget=', "BAD_REQ", 'isbn');
    }
    // If nCopies<=the number of patrons that have the book, return an error indicating no copies are available
    else if (this.books[req.isbn].nCopies <= this.bookPatron[req.isbn].length) {
      return Errors.errResult(': no copies of book ${req.isbn} are available for checkout; widget=', "BAD_REQ", 'isbn');
    }
    this.patronArray[req.patronId].push(req.isbn);
    this.bookPatron[req.isbn].push(req.patronId);
    return Errors.okResult(undefined);  
  }
  
  returnBook(req: ReturnBookReq) : Errors.Result<void> {
    //TODO 
    if(req.patronId === undefined){
      return Errors.errResult(': property patronId is required; widget=', "MISSING",'patronId');
    }
    else if(req.isbn === undefined){
      return Errors.errResult(': property isbn is required; widget=', "MISSING",'isbn');
    }
    else if (typeof req.patronId !== 'string'){
      return Errors.errResult(': property patronId must be string; widget=','BAD_TYPE','patronId');
    }
    else if (typeof req.isbn !== 'string'){
      return Errors.errResult(': property isbn must be string; widget=','BAD_TYPE','isbn');
    }
    // errors on bad book
    if(!this.books[req.isbn]){
      return Errors.errResult('unknown book ${req.isbn}; widget=', "BAD_REQ", 'isbn')
    }
    //if patronId is not present
    if(!this.patronArray[req.patronId]){
      return Errors.errResult('unknown patron ${req.patronId}; widget=', "BAD_REQ", 'patronId');
    }
    //does not allow repeated return of books
    else if(!this.patronArray[req.patronId].includes(req.isbn)){
      return Errors.errResult('no checkout of book ${req.isbn} by patron ${req.patronId}', 'BAD_REQ', 'isbn');
    }
    const patronBooksIndex = this.patronArray[req.patronId].indexOf(req.isbn);
    if (patronBooksIndex > -1) {
      this.patronArray[req.patronId].splice(patronBooksIndex, 1);
    }
    const bookPatronsIndex = this.bookPatron[req.isbn].indexOf(req.patronId);
    if (bookPatronsIndex > -1) {
      this.bookPatron[req.isbn].splice(bookPatronsIndex, 1);
    }
    return Errors.okResult(undefined);
  }


/********************** Domain Utility Functions ***********************/


//TODO: add domain-specific utility functions or classes.
  wordCollection(req: Record<string, any>): void {
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

