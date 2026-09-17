// The Content Security Policy directive every editor webview needs for its
// icons to draw (an-editor-panel-draws-its-icons).
//
// The Metro icon subset is a font carried inside the bundle's stylesheet as a
// `data:` URL, so that a host refusing other origins still draws it. A policy
// of `default-src 'none'` with no `font-src` refuses `data:` fonts too, and
// every panel shipped that way: the stylesheet arrived (#537), the font did
// not, and each icon was an empty box. Only `data:` is allowed — no origin
// the bundle does not carry.

export const ICON_FONT_SOURCE = "font-src data:;";
