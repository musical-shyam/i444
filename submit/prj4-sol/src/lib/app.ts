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
  private handleSearchBlur() {
    const searchUrl = makeQueryUrl(this.wsUrl + '/api/books', { search: this.search.value });
    // Log the constructed URL to the console
    this.fetchSearchResults(searchUrl);
    
  }
  private async fetchSearchResults(url: URL | string) {
    try {
      this.clearErrors(); //clears previous errors
      const result = await this.ws.findBooksByUrl(url);
      console.log("Search Results:", result); 
      if (result.isOk) {
        this.displaySearchResults(result.val.result, result.val.links);  // Method to update the UI with results
      } else {
        this.unwrap(result) // Display error messages if the search failed
      }
    } catch (error) {
      console.error("Error fetching search results:", error);
    }
  }
  
  private displaySearchResults(books: Array<any>, links: NavLinks) {
    // Clear previous results
    this.result.innerHTML = '';
    const scrollControlsTop = this.createScrollControls(links);
    const scrollControlsBottom = this.createScrollControls(links);

    // Append top scroll controls
    this.result.appendChild(scrollControlsTop);
    // Create the ul element with id 'search-results'
    const ul = makeElement('ul', {id: 'search-results'});

    books.forEach(book => {
      // Create the title span and details link directly with text content
      const titleSpan = makeElement('span', {class: 'content'}, book.result.title); // Assuming makeElement can handle strings as children
      const detailsLink = makeElement('a', {class: 'details', href: book.links.self.href}, 'details...');
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
        const prevLink = makeElement('a', {rel: 'prev', href: '#'}, '<<');
        prevLink.addEventListener('click', (event) => {
            event.preventDefault();
            this.fetchSearchResults(links.prev.href);
        });
        div.appendChild(prevLink);
    }

    if (links.next) {
        const nextLink = makeElement('a', {rel: 'next', href: '#'}, '>>');
        nextLink.addEventListener('click', (event) => {
            event.preventDefault();
            this.fetchSearchResults(links.next.href);
        });
        div.appendChild(nextLink);
    }

    return div;
  }
  private handleDetailsClick(url: string) {
    console.log("Details URL:", url);  // Log the URL to the console
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
