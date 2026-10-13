// Isolated fixture messages, with no player, account, storage or network access.
const { ipcRenderer } = require('electron');
let state;
ipcRenderer.on('taskbar:request-state', () => {
  if (state) ipcRenderer.send('taskbar:update-state', state);
});
ipcRenderer.on('taskbar:fixture-state', (_event, data) => {
  state = data.state;
  ipcRenderer.send('taskbar:update-state', state);
  ipcRenderer.send('taskbar:fixture-ack', data.label);
});
ipcRenderer.on('global-shortcut', (_event, action) => {
  ipcRenderer.send('taskbar:fixture-action', action);
});
