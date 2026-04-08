export type UploadedFile = {
  name: string;
  size: number;
  type: string;
  note?: string;
  path?: string;
};

export type ClientAttachment = UploadedFile & {
  extractedText?: string;
  dataUrl?: string;
  kind?: 'text' | 'image' | 'binary';
};

export type UiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  uploads?: UploadedFile[];
  timestamp?: number;
};
