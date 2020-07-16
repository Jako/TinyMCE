import { Element, Node, Range, Selection, Window } from '@ephox/dom-globals';
import { Option } from '@ephox/katamari';
import * as NativeRange from '../../selection/core/NativeRange';
import * as SelectionDirection from '../../selection/core/SelectionDirection';
import * as CaretRange from '../../selection/query/CaretRange';
import * as Within from '../../selection/query/Within';
import * as Prefilter from '../../selection/quirks/Prefilter';
import * as Compare from '../dom/Compare';
import * as DocumentPosition from '../dom/DocumentPosition';
import { SugarElement } from '../node/SugarElement';
import * as SugarFragment from '../node/SugarFragment';
import { SimRange } from './SimRange';
import { SimSelection } from './SimSelection';
import { Situ } from './Situ';

const doSetNativeRange = (win: Window, rng: Range): void => {
  Option.from(win.getSelection()).each((selection) => {
    selection.removeAllRanges();
    selection.addRange(rng);
  });
};

const doSetRange = (win: Window, start: SugarElement<Node>, soffset: number, finish: SugarElement<Node>, foffset: number): void => {
  const rng = NativeRange.exactToNative(win, start, soffset, finish, foffset);
  doSetNativeRange(win, rng);
};

const findWithin = (win: Window, selection: SimSelection, selector: string): SugarElement<Element>[] =>
  Within.find(win, selection, selector);

const setLegacyRtlRange = (win: Window, selection: Selection, start: SugarElement<Node>, soffset: number, finish: SugarElement<Node>, foffset: number): void => {
  selection.collapse(start.dom(), soffset);
  selection.extend(finish.dom(), foffset);
};

const setRangeFromRelative = (win: Window, relative: SimSelection): void =>
  SelectionDirection.diagnose(win, relative).match({
    ltr(start, soffset, finish, foffset) {
      doSetRange(win, start, soffset, finish, foffset);
    },
    rtl(start, soffset, finish, foffset) {
      const selection = win.getSelection();
      // If this selection is backwards, then we need to use extend.
      if (selection.setBaseAndExtent) {
        selection.setBaseAndExtent(start.dom(), soffset, finish.dom(), foffset);
      } else if ((selection as any).extend) {
        // This try catch is for older browsers (Firefox 52) as they're sometimes unable to handle setting backwards selections using selection.extend and error out.
        try {
          setLegacyRtlRange(win, selection, start, soffset, finish, foffset);
        } catch (e) {
          // If it does fail, try again with ltr.
          doSetRange(win, finish, foffset, start, soffset);
        }
      } else {
        doSetRange(win, finish, foffset, start, soffset);
      }
    }
  });

const setExact = (win: Window, start: SugarElement<Node>, soffset: number, finish: SugarElement<Node>, foffset: number): void => {
  const relative = Prefilter.preprocessExact(start, soffset, finish, foffset);

  setRangeFromRelative(win, relative);
};

const setRelative = (win: Window, startSitu: Situ, finishSitu: Situ): void => {
  const relative = Prefilter.preprocessRelative(startSitu, finishSitu);

  setRangeFromRelative(win, relative);
};

const toNative = (selection: SimSelection): Range => {
  const win: Window = SimSelection.getWin(selection).dom();
  const getDomRange = (start: SugarElement<Node>, soffset: number, finish: SugarElement<Node>, foffset: number) => NativeRange.exactToNative(win, start, soffset, finish, foffset);
  const filtered = Prefilter.preprocess(selection);
  return SelectionDirection.diagnose(win, filtered).match({
    ltr: getDomRange,
    rtl: getDomRange
  });
};

// NOTE: We are still reading the range because it gives subtly different behaviour
// than using the anchorNode and focusNode. I'm not sure if this behaviour is any
// better or worse; it's just different.
const readRange = (selection: Selection) => {
  if (selection.rangeCount > 0) {
    const firstRng = selection.getRangeAt(0);
    const lastRng = selection.getRangeAt(selection.rangeCount - 1);

    return Option.some(SimRange.create(
      SugarElement.fromDom(firstRng.startContainer),
      firstRng.startOffset,
      SugarElement.fromDom(lastRng.endContainer),
      lastRng.endOffset
    ));
  } else {
    return Option.none<SimRange>();
  }
};

const doGetExact = (selection: Selection) => {
  const anchor = SugarElement.fromDom(selection.anchorNode);
  const focus = SugarElement.fromDom(selection.focusNode);

  // if this returns true anchor is _after_ focus, so we need a custom selection object to maintain the RTL selection
  return DocumentPosition.after(anchor, selection.anchorOffset, focus, selection.focusOffset) ? Option.some(
    SimRange.create(
      anchor,
      selection.anchorOffset,
      focus,
      selection.focusOffset
    )
  ) : readRange(selection);
};

const setToElement = (win: Window, element: SugarElement<Node>) => {
  const rng = NativeRange.selectNodeContents(win, element);
  doSetNativeRange(win, rng);
};

const forElement = (win: Window, element: SugarElement<Node>) => {
  const rng = NativeRange.selectNodeContents(win, element);
  return SimRange.create(
    SugarElement.fromDom(rng.startContainer), rng.startOffset,
    SugarElement.fromDom(rng.endContainer), rng.endOffset
  );
};

const getExact = (win: Window) =>
  // We want to retrieve the selection as it is.
  Option.from(win.getSelection())
    .filter((sel) => sel.rangeCount > 0)
    .bind(doGetExact);

// TODO: Test this.
const get = (win: Window) =>
  getExact(win).map((range) => SimSelection.exact(range.start(), range.soffset(), range.finish(), range.foffset()));

const getFirstRect = (win: Window, selection: SimSelection) => {
  const rng = SelectionDirection.asLtrRange(win, selection);
  return NativeRange.getFirstRect(rng);
};

const getBounds = (win: Window, selection: SimSelection) => {
  const rng = SelectionDirection.asLtrRange(win, selection);
  return NativeRange.getBounds(rng);
};

const getAtPoint = (win: Window, x: number, y: number) => CaretRange.fromPoint(win, x, y);

const getAsString = (win: Window, selection: SimSelection) => {
  const rng = SelectionDirection.asLtrRange(win, selection);
  return NativeRange.toString(rng);
};

const clear = (win: Window) => {
  const selection = win.getSelection();
  selection.removeAllRanges();
};

const clone = (win: Window, selection: SimSelection) => {
  const rng = SelectionDirection.asLtrRange(win, selection);
  return NativeRange.cloneFragment(rng);
};

const replace = (win: Window, selection: SimSelection, elements: SugarElement<Node>[]) => {
  const rng = SelectionDirection.asLtrRange(win, selection);
  const fragment = SugarFragment.fromElements(elements, win.document);
  NativeRange.replaceWith(rng, fragment);
};

const deleteAt = (win: Window, selection: SimSelection) => {
  const rng = SelectionDirection.asLtrRange(win, selection);
  NativeRange.deleteContents(rng);
};

const isCollapsed = (start: SugarElement<Node>, soffset: number, finish: SugarElement<Node>, foffset: number) =>
  Compare.eq(start, finish) && soffset === foffset;

export {
  setExact,
  getExact,
  get,
  setRelative,
  toNative,
  setToElement,
  clear,
  clone,
  replace,
  deleteAt,
  forElement,
  getFirstRect,
  getBounds,
  getAtPoint,
  findWithin,
  getAsString,
  isCollapsed
};
