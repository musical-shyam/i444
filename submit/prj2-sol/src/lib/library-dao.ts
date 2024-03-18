import * as mongo from 'mongodb';

import { Errors } from 'cs544-js-utils';

import * as Lib from './library.js';

//TODO: define any DB specific types if necessary

export async function makeLibraryDao(dbUrl: string) {
  return await LibraryDao.make(dbUrl);
}

//options for new MongoClient()
const MONGO_OPTIONS = {
  ignoreUndefined: true,  //ignore undefined fields in queries
};


export class LibraryDao {

  //called by below static make() factory function with
  //parameters to be cached in this instance.
  constructor(private readonly client: mongo.MongoClient,
    private readonly library: mongo.Collection<Lib.XBook>,
    private readonly Patrons: mongo.Collection<Lib.Lend>) {
}

  //static factory function; should do all async operations like
  //getting a connection and creating indexing.  Finally, it
  //should use the constructor to return an instance of this class.
  //returns error code DB on database errors.
  static async make(dbUrl: string) : Promise<Errors.Result<LibraryDao>> {
    try {
      const client = await (new mongo.MongoClient(dbUrl, MONGO_OPTIONS)).connect();
      const db = client.db();
      const library = db.collection<Lib.XBook>('Books');
      const patronsCollection = db.collection<Lib.Lend>('Patrons');
      await library.createIndex({ title: 'text', authors: 'text'} );//{ unique: true }
      return Errors.okResult(new LibraryDao(client, library, patronsCollection));  
    }
    catch (error) {
      return Errors.errResult(error.message, 'DB');
    }
  }

  /** close off this DAO; implementing object is invalid after 
   *  call to close() 
   *
   *  Error Codes: 
   *    DB: a database error was encountered.
   */
  async close() : Promise<Errors.Result<void>> {
    try {
      await this.client.close();
      return Errors.VOID_RESULT;
    }
    catch (err) {
      return Errors.errResult((err as Error).message, 'DB');
    }

  }
  
  //add methods as per your API

  //clearing out all the book collection
  async clear() : Promise<Errors.Result<void>> {
    try {
      await this.library.deleteMany({});
      return Errors.VOID_RESULT;
    }
    catch (err) {
      return Errors.errResult((err as Error).message, 'DB');
    }
  }
  // finding books by isbn in the collection
  async findIsbn(isbn: string): Promise<Errors.Result<Lib.XBook>> {
    try 
    {
      const book = await this.library.findOne({ isbn: isbn },);
      if (book) {
        return Errors.okResult(book);
      }
       else {
        return Errors.errResult(`No book found with ISBN '${isbn}'`, { code: 'NOT_FOUND' });
     }
    } catch (err) {
       return Errors.errResult((err as Error).message, 'DB');
    }
  }
  
  // adding books into the collection
  async addBook(book: Lib.XBook): Promise<Errors.Result<Lib.XBook>> {
    try {
      await this.library.insertOne(book);
      return Errors.okResult(book);
    } catch (err) {
      return Errors.errResult((err as Error).message, 'DB');
    }
  }
  // updating the copy number when adding existing book
  async updateCopies(isbn: string, extraCopies: number): Promise<Errors.Result<void>> {
    try {
        const Result = await this.library.updateOne(
            { isbn: isbn },
            { $inc: { nCopies: extraCopies } }
        );

        if (Result.matchedCount === 0) {
            return Errors.errResult(`No book found with ISBN '${isbn}'`, 'NOT_FOUND');
        }

        return Errors.okResult(undefined);
    } catch (error) {
        return Errors.errResult(error.message, 'DB');
    }
}

  // finding the books which has the string in its author and title
  async findBook(Find: {search: string; index: number; count: number;}): Promise<Errors.Result<Lib.Book[]>> 
  {
    try {
      const searchWords = '"'+ Find.search.toLowerCase().split(/\W+/).join('" "')+'"' ; 
      const searchBooks = await this.library.find({ $text: { $search: searchWords } }, { projection: {  _id: 0 } });
      const books = await searchBooks.sort({ title: 1 }).skip(Find.index).limit(Find.count).toArray();
      return Errors.okResult(books);
    } 
    catch (err) {
      return Errors.errResult(err.message, 'DB');
    }
  }
  
  // to checkoutBooks from the database
  async checkoutBook(checkOutReq: Lib.Lend): Promise<Errors.Result<void>> {
    try {
      const { isbn, patronId } = checkOutReq;
      const checkoutResult = await this.Patrons.insertOne({ isbn, patronId });
      if (checkoutResult.acknowledged) {// returns without error
        return Errors.VOID_RESULT;
      }
      return Errors.errResult("Failed to checkout book", "DB");
    } catch (error) {
      return Errors.errResult(error.message, "DB");
    }
  }
  // finding the copies available for checkout
  async avlCopies(isbn: string): Promise<number> {
    try {
        const checkedOutPatrons = await this.Patrons.find({ isbn: isbn }).toArray();
        const book = await this.library.findOne({ isbn: isbn },)
        if (!book) {
          return -1;
        }
        const totalCopies = book.nCopies;
        return totalCopies - checkedOutPatrons.length;
    } catch (error) {
        console.error("Error in getAvailableCopies:", error);
        return -1; // Indicate error with a negative value
    }
}

  async isPatronCheckedOut(bookId: string, patronId: string): Promise<boolean> {
    try {
        const patron = await this.Patrons.findOne({ isbn: bookId, patronId: patronId });
        return !!patron; // Convert to boolean
    } catch (error) {
        console.error("Error in hasPatronCheckedOut:", error);
        return false; // Default to false in case of error
    }
  }
  //returns the checked out book
  async returnBook(returnReq: Lib.Lend): Promise<Errors.Result<void>> {
    try {
      const { isbn, patronId } = returnReq;

      // Deleting the checkout information
      const returnResult = await this.Patrons.deleteOne({ isbn, patronId });
      // If the return operation is acknowledged, return void result
      if (returnResult.acknowledged) {
        return Errors.VOID_RESULT;
      }

      return Errors.errResult("Failed to return book", "DB");

    } catch (error) {
      return Errors.errResult(error.message, "DB");
    }
  }
} //class LibDao