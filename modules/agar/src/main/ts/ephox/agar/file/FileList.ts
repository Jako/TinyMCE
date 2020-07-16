import { File, FileList } from '@ephox/dom-globals';
import { Arr } from '@ephox/katamari';

const createFileList = (inputFiles: File[]): FileList => {
  const files = {
    length: inputFiles.length,

    item: (idx: number) => inputFiles[idx]
  };

  Arr.each(inputFiles, (file, idx) => {
    files[idx] = file;
  });

  return Object.freeze(files) as unknown as FileList;
};

export {
  createFileList
};
