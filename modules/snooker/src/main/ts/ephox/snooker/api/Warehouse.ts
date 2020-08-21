import { Arr, Optional } from '@ephox/katamari';
import { SugarElement, Traverse } from '@ephox/sugar';
import * as Structs from '../api/Structs';
import * as DetailsList from '../model/DetailsList';

export interface Warehouse {
  readonly grid: Structs.Grid;
  readonly access: Record<string, Structs.DetailExt>;
  readonly all: Structs.RowData<Structs.DetailExt>[];
  readonly groups: SugarElement[];
}

const key = function (row: number, column: number) {
  return row + ',' + column;
};

const getAt = function (warehouse: Warehouse, row: number, column: number) {
  const raw = warehouse.access[key(row, column)];
  return raw !== undefined ? Optional.some(raw) : Optional.none<Structs.DetailExt>();
};

const findItem = function <T> (warehouse: Warehouse, item: T, comparator: (a: T, b: SugarElement) => boolean) {
  const filtered = filterItems(warehouse, function (detail) {
    return comparator(item, detail.element);
  });

  return filtered.length > 0 ? Optional.some(filtered[0]) : Optional.none<Structs.DetailExt>();
};

const filterItems = function (warehouse: Warehouse, predicate: (x: Structs.DetailExt, i: number) => boolean) {
  const all = Arr.bind(warehouse.all, function (r) { return r.cells; });
  return Arr.filter(all, predicate);
};

/*
 * From a list of list of Detail, generate three pieces of information:
 *  1. the grid size
 *  2. a data structure which can efficiently identify which cell is in which row,column position
 *  3. a list of all cells in order left-to-right, top-to-bottom
 */
const generate = function <T extends Structs.Detail> (list: Structs.RowData<T>[]): Warehouse {
  // list is an array of objects, made by cells and elements
  // elements: is the TR
  // cells: is an array of objects representing the cells in the row.
  //        It is made of:
  //          colspan (merge cell)
  //          element
  //          rowspan (merge cols)
  const access: Record<string, Structs.DetailExt> = {};
  const cells: Structs.RowData<Structs.DetailExt>[] = [];
  let groups: SugarElement[] = [];

  let maxRows = 0;
  let maxColumns = 0;

  Arr.each(list, function (details, r) {
    const currentRow: Structs.DetailExt[] = [];
    Arr.each(details.cells, function (detail) {
      let start = 0;

      // If this spot has been taken by a previous rowspan, skip it.
      while (access[key(r, start)] !== undefined) {
        start++;
      }

      const current = Structs.extended(detail.element, detail.rowspan, detail.colspan, r, start);

      // Occupy all the (row, column) positions that this cell spans for.
      for (let i = 0; i < detail.colspan; i++) {
        for (let j = 0; j < detail.rowspan; j++) {
          const cr = r + j;
          const cc = start + i;
          const newpos = key(cr, cc);
          access[newpos] = current;
          maxColumns = Math.max(maxColumns, cc + 1);
        }
      }

      currentRow.push(current);
    });

    if (details.section === 'colgroup') {
      groups = Traverse.children(details.element);
      groups = Arr.filter(groups, (element): boolean =>
        element.dom.nodeName === 'COL'
      );
    } else {
      maxRows++;
      cells.push(Structs.rowdata(details.element, currentRow, details.section));
    }
  });

  const grid = Structs.grid(maxRows, maxColumns);

  return {
    grid,
    access,
    all: cells,
    groups
  };
};

const fromTable = (table: SugarElement<HTMLTableElement>) => {
  const list = DetailsList.fromTable(table);
  return generate(list);
};

const justCells = function (warehouse: Warehouse) {
  const rows = Arr.map(warehouse.all, (w) => w.cells);

  return Arr.flatten(rows);
};

const justColumns = (warehouse: Warehouse) =>
  Arr.map(warehouse.groups, (group) => group);

const hasColumns = (warehouse: Warehouse) =>
  warehouse.groups.length > 0;

export const Warehouse = {
  fromTable,
  generate,
  getAt,
  findItem,
  filterItems,
  justCells,
  justColumns,
  hasColumns
};
