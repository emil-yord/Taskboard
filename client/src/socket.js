import { io } from 'socket.io-client';
import { API_URL } from './api';

let socket = null;

export function getSocket() {
  if (socket) return socket;

  const token = localStorage.getItem('taskboard_token');
  socket = io(API_URL, {
    auth: { token },
    autoConnect: false
  });
  return socket;
}

export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
