export type UploadedFile = {
  name: string;
  size: number;
  type: string;
  note?: string;
};

export type ClientAttachment = UploadedFile & {
  extractedText?: string;
};

export type UiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  uploads?: UploadedFile[];
};
