import { Errors } from 'cs544-js-utils';

//types defined in library.ts in earlier projects
import * as Lib from 'library-types';


import { NavLinks, LinkedResult, PagedEnvelope, SuccessEnvelope }
  from './response-envelopes.js';

import { makeLibraryWs, LibraryWs } from './library-ws.js';

import { makeElement, makeQueryUrl } from './utils.js';

export default function makeApp(wsUrl: string) {
  return new App(wsUrl);
}


class App {
  private readonly wsUrl: string;
  private readonly ws: LibraryWs;

  private readonly result: HTMLElement;
  private readonly errors: HTMLElement;
  private readonly search: HTMLInputElement;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
    this.ws = makeLibraryWs(wsUrl);
    this.result = document.querySelector('#result');
    this.errors = document.querySelector('#errors');
    //TODO: add search handler
    this.search = document.querySelector("#search") as HTMLInputElement;
    this.search.addEventListener('blur', this.handleSearchBlur.bind(this));
  }
  
  //TODO: add private methods as needed
  //this function is used for handling the search words continuously
  private handleSearchBlur() {
    const searchUrl = makeQueryUrl(this.wsUrl + '/api/books', { search: this.search.value });
    // Log the constructed URL to the console
    this.fetchSearchResults(searchUrl);
    
  }

  //this function fetches the search results 5 at a time
  //used by blur handler and scroll handler
  private async fetchSearchResults(url: URL | string) {
    try {
      this.clearErrors(); //clears previous errors
      const result = await this.ws.findBooksByUrl(url);
      console.log("Search Results:", result); 
      if (result.isOk) {
        this.displaySearchResults(result.val.result, result.val.links);  // Method to update the UI with results
      } else {
        this.result.innerHTML = '';
        this.unwrap(result); // Display error messages if the search failed
      }
    } catch (error) {
      console.error("Error fetching search results:", error);
    }
  }
  
  //formats and displays the search results
  //used by fetch handler
  private displaySearchResults(books: Array<any>, links: NavLinks) {
    
    this.result.innerHTML = '';// Clear previous results
    const scrollControlsTop = this.createScrollControls(links);
    const scrollControlsBottom = this.createScrollControls(links);
    // Append top scroll controls
    this.result.appendChild(scrollControlsTop);
    
    const ul = makeElement('ul', {id: 'search-results'}); // Create the ul element with id 'search-results'

    books.forEach(book => {
      // Create the title span and details link directly with text content
      const titleSpan = makeElement('span', {class: 'content'}, book.result.title); // 
      const detailsLink = makeElement('a', {class: 'details'}, 'details...');
      detailsLink.addEventListener('click', (event) => {
        event.preventDefault();  // Prevent the default anchor click behavior
        this.handleDetailsClick(book.links.self.href);  // Call the auxiliary method
      });
      // Append titleSpan and detailsLink to the list item
      const li = makeElement('li', {}, titleSpan, detailsLink);

      // Append the list item to the ul element
      ul.appendChild(li);
    });
    // Append the ul to the result container
    this.result.appendChild(ul);
    // Append bottom scroll controls
    this.result.appendChild(scrollControlsBottom);
  }
  private createScrollControls(links: NavLinks): HTMLElement {
    const div = makeElement('div', {class: 'scroll'});

    if (links.prev) {
        const prevLink = makeElement('a', {rel: 'prev'}, '<<');
        prevLink.addEventListener('click', (event) => {
            event.preventDefault();
            this.fetchSearchResults(links.prev.href);
        });
        div.appendChild(prevLink);
    }

    if (links.next) {
        const nextLink = makeElement('a', {rel: 'next'}, '>>');
        nextLink.addEventListener('click', (event) => {
            event.preventDefault();
            this.fetchSearchResults(links.next.href);
        });
        div.appendChild(nextLink);
    }

    return div;
  }
  private async handleDetailsClick(url: string) {
    try {
      // Call the getBookByUrl method from the LibraryWs class
      const result = await this.ws.getBookByUrl(url);
      if (result.isOk) {
        this.displayBookDetails(result.val.result);
      } 
      else {
        this.unwrap(result);  // Assuming you have a method to display errors
      }
    } 
    catch (error) {
      console.error("Error fetching book details:", error);  // Log errors if any
    }
  }
  private displayBookDetails(book: Lib.Book) {
    this.result.innerHTML = '';  // Clear previous results

    const dl = makeElement('dl', {class: 'book-details'});

    // Dynamically creating each detail item
    dl.appendChild(makeElement('dt', {}, 'ISBN'));
    dl.appendChild(makeElement('dd', {}, book.isbn || 'N/A'));

    dl.appendChild(makeElement('dt', {}, 'Title'));
    dl.appendChild(makeElement('dd', {}, book.title || 'N/A'));

    dl.appendChild(makeElement('dt', {}, 'Authors'));
    dl.appendChild(makeElement('dd', {}, book.authors?.join('; ') || 'N/A'));

    dl.appendChild(makeElement('dt', {}, 'Number of Pages'));
    dl.appendChild(makeElement('dd', {}, book.pages?.toString() || 'N/A'));

    dl.appendChild(makeElement('dt', {}, 'Publisher'));
    dl.appendChild(makeElement('dd', {}, book.publisher || 'N/A'));

    dl.appendChild(makeElement('dt', {}, 'Number of Copies'));
    dl.appendChild(makeElement('dd', {}, book.nCopies?.toString() || 'N/A'));

    // Special handling for Borrowers which may be populated later
    dl.appendChild(makeElement('dt', {}, 'Borrowers'));
    dl.appendChild(makeElement('dd', {id: 'borrowers'}, 'None'));  // Initially no borrowers

    this.result.appendChild(dl);  // Add the details list to the result container
    this.appendCheckoutForm(book.isbn); // Call to append the checkout form below the book details
  }
  private async appendCheckoutForm(isbn: string) {
    const form = makeElement('form', {class: 'grid-form'});
    await this.updateBorrowersDisplay(isbn);
    form.onsubmit = async (event) => {
      event.preventDefault();  // Prevent the default form submission behavior

      const patronIdInput = document.getElementById('patronId') as HTMLInputElement;
      const patronId = patronIdInput.value.trim();

      // Clear previous errors
      this.clearErrors();  // This will clear the display of any existing error messages


      // Call the checkoutBook method with the isbn and patronId
      const result = await this.ws.checkoutBook({ isbn, patronId });
      if (result.isOk) {
        console.log("Checkout successful");
        await this.updateBorrowersDisplay(isbn); // Update the borrowers display after successful checkout
      } 
      else{
        this.unwrap(result);
      }
    };
    form.addEventListener('submit', this.handleCheckout.bind(this, isbn)); // Add event listener for form submission

    // Create label and input for Patron ID
    const label = makeElement('label', {for: 'patronId'}, 'Patron ID');
    const breakTag = makeElement('br');
    const breakTag2 = makeElement('br');
    const input = makeElement('input', {id: 'patronId', type: 'text', name: 'patronId'});
    const errorSpan = makeElement('span', {class: 'error', id: 'patronId-error'});
    const box  = makeElement('span',{},input, breakTag, errorSpan, breakTag2);
    // Create the submit button
    const button = makeElement('button', {type: 'submit'}, 'Checkout Book');

    // Appending label, input, error message span, and button to the form
    form.appendChild(label);
    form.appendChild(makeElement('span',{},box,makeElement('br'),button));

    // Append the form to the result container
    this.result.appendChild(form);
  }
  private handleCheckout(isbn: string, event: Event) {
      event.preventDefault(); // Prevent the default form submission behavior
      const patronId = (document.getElementById('patronId') as HTMLInputElement).value.trim();
      console.log("Attempting to checkout book:", isbn, "for patron:", patronId);
  }
  private async updateBorrowersDisplay(isbn: string) {
    const result = await this.ws.getLends(isbn);
     
    const borrowersElement = document.getElementById('borrowers') as HTMLElement;
    borrowersElement.innerHTML = ''; // Clear existing content

    if (result.isOk && result.val.length > 0) {
        const ul = document.createElement('ul');
        result.val.forEach(lend => {
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.className = 'content';
            span.textContent = lend.patronId; // Assuming `patronName` is available
            li.appendChild(span);

            const button = document.createElement('button');
            button.className = 'return-book';
            button.textContent = 'Return Book';
            button.onclick = () => this.handleReturnBook(isbn, lend.patronId); // handleReturnBook needs to be implemented
            li.appendChild(button);

            ul.appendChild(li);
        });
        borrowersElement.appendChild(ul);
    } else if (result.isOk) {
        borrowersElement.textContent = 'None'; // Displaying 'None' if no lendings
    } else {
        this.unwrap(result); // Handle errors
    }
  }
  private async handleReturnBook(isbn: string, patronId: string) {
    const returnResult = await this.ws.returnBook({ isbn, patronId });
    if (returnResult.isOk) {
        console.log("Return successful");
        await this.updateBorrowersDisplay(isbn); // Update display after returning a book
    } else {
        this.unwrap(returnResult); // Handle errors in returning the book
    }
  }
  /** unwrap a result, displaying errors if !result.isOk, 
   *  returning T otherwise.   Use as if (unwrap(result)) { ... }
   *  when T !== void.
   */
  private unwrap<T>(result: Errors.Result<T>) {
    if (result.isOk === false) {
      displayErrors(result.errors);
    }
    else {
      return result.val;
    }
  }

  /** clear out all errors */
  private clearErrors() {
    this.errors.innerHTML = '';
    document.querySelectorAll(`.error`).forEach( el => {
      el.innerHTML = '';
    });
  }

} //class App

/** Display errors. If an error has a widget or path widgetId such
 *  that an element having ID `${widgetId}-error` exists,
 *  then the error message is added to that element; otherwise the
 *  error message is added to the element having to the element having
 *  ID `errors` wrapped within an `<li>`.
 */  
function displayErrors(errors: Errors.Err[]) {
  for (const err of errors) {
    const id = err.options.widget ?? err.options.path;
    const widget = id && document.querySelector(`#${id}-error`);
    if (widget) {
      widget.append(err.message);
    }
    else {
      const li = makeElement('li', {class: 'error'}, err.message);
      document.querySelector(`#errors`)!.append(li);
    }
  }
}

//TODO: add functions as needed
