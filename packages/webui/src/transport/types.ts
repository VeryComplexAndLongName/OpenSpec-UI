// Transport — единственная граница, за которой компоненты `webui` не знают,
// работают ли они в браузере (standalone) или в Webview (VS Code extension).
// Компоненты вызывают только этот интерфейс, никогда `fetch`/`postMessage`
// напрямую (см. spec.md, "Компоненты не зависят от конкретного транспорта").

import type { Command, Event } from "@openspec-ui/core";

export type Unsubscribe = () => void;

export interface Transport {
  /** Отправляет команду. Не возвращает результат напрямую — результат
   * приходит как поток событий через `subscribe` (см. design.md: единый
   * event-driven протокол, а не запрос/ответ). */
  send(command: Command): void;
  /** Подписывается на ВСЕ события, полученные этим transport'ом (события
   * от разных `runId` могут приходить конкурентно — потребитель фильтрует
   * сам). Возвращает функцию отписки. */
  subscribe(onEvent: (event: Event) => void): Unsubscribe;
}
