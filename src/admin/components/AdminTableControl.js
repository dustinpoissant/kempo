import ButtonControl from '/kempo-ui/components/controls/ButtonControl.js';

/*
  Shared base for the admin's table controls.

  kempo-ui's Control resolves its host through closest('[controlled]'), which k-table sets on
  itself, but it deliberately leaves the per-row lookup to each control. Rather than repeat that
  lookup in every admin control, it lives here once — it is the one place coupled to k-table's row
  markup (`.record[data-index]` indexing into `host.records`).

  Controls that sit in a row get a `record`; controls placed at the table level get `null`.
*/
export default class AdminTableControl extends ButtonControl {
  get table(){
    return this.host;
  }

  get record(){
    const row = this.closest('.record');
    const index = row?.dataset?.index;
    if(index === undefined) return null;
    return this.host?.records?.[index] ?? null;
  }
}
