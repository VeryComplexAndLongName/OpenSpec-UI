# @openspec-ui/server

Тонкий REST/WS слой над `@openspec-ui/core` — не содержит бизнес-логики,
только сериализация протокола команд/событий под HTTP/WebSocket. Bind по
умолчанию на `127.0.0.1`.

Используется standalone-инструментом (`openspec/changes/standalone-app/`)
и опционально VS Code extension'ом (`openspec/changes/vscode-extension/`,
режим локального сервера).

Реализуется по `openspec/changes/standalone-app/tasks.md`. Ничего не
реализовано — подготовлена только структура.
