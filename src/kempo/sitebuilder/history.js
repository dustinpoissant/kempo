/*
  Undo and redo for the editor. Each step is a deep copy of the whole state, which handles nesting and moves with no
  special cases. Nothing is saved anywhere: a reload starts the history again. Past the limit the oldest steps drop off.
*/
export const HISTORY_LIMIT = 50;

export default class History {
  #undo = [];
  #redo = [];

  constructor(limit = HISTORY_LIMIT){
    this.limit = limit;
  }

  /* Call before changing the state, with the state as it is. */
  push = state => {
    this.#undo.push(structuredClone(state));
    if(this.#undo.length > this.limit) this.#undo.shift();
    this.#redo = [];
  };

  get canUndo(){
    return this.#undo.length > 0;
  }

  get canRedo(){
    return this.#redo.length > 0;
  }

  /* Returns the state to go back to, or null. Pass the current state so it can be redone. */
  undo = current => {
    if(!this.#undo.length) return null;
    this.#redo.push(structuredClone(current));
    return this.#undo.pop();
  };

  redo = current => {
    if(!this.#redo.length) return null;
    this.#undo.push(structuredClone(current));
    return this.#redo.pop();
  };

  get size(){
    return this.#undo.length;
  }
}
