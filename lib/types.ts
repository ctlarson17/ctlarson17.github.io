export type UploadedFile = {
  name: string;
  size: number;
  type: string;
};

export type UiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  uploads?: UploadedFile[];
};
