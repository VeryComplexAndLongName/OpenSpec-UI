# standalone-app Specification

## Purpose
Standalone web-инструмент (тонкий REST/WS сервер над `execution-core` + браузерная сборка `webui`) для пользователей без VS Code.

## ADDED Requirements

### Requirement: Сервер не содержит бизнес-логики
Система SHALL реализовывать `server` исключительно как сериализацию протокола команд/событий `execution-core` под HTTP/WebSocket. Система SHALL NOT дублировать логику запуска агентов, security-проверки или вычисление статуса change'а внутри `server` — эти операции SHALL выполняться вызовом `execution-core`.

#### Scenario: Изменение security-модели в execution-core
- **WHEN** правило allowlist/cwd-sandbox меняется в `execution-core`
- **THEN** поведение `server` меняется автоматически без правок в коде `server`

### Requirement: Сервер по умолчанию доступен только локально
Система SHALL по умолчанию принимать подключения только с localhost. Система SHALL NOT принимать подключения с других интерфейсов без явного намеренного изменения конфигурации пользователем.

#### Scenario: Запуск сервера без явной конфигурации сети
- **WHEN** пользователь запускает `server` со значениями по умолчанию
- **THEN** сервер недоступен с других машин в сети
