import { sendRuntimeMessage } from './extensionApi';

export function sendMessage<T>(message: unknown): Promise<T> {
  return sendRuntimeMessage<T>(message);
}
