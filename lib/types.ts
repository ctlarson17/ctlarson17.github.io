export type UiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};
