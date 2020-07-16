import { HTMLElement } from '@ephox/dom-globals';
import { SugarElement } from 'ephox/sugar/api/node/SugarElement';

export default () => SugarElement.fromHtml<HTMLElement>('<math xmlns="http://www.w3.org/1998/Math/MathML"></math>');
