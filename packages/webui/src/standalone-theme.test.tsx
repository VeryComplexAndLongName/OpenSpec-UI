import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "./components/ThemeToggle.js";
import {
  DARK_SCHEME_QUERY,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  useStandaloneTheme,
  type ThemeEnvironment,
} from "./standalone-theme.js";

/** A system preference that can be changed while the shell is open. */
function fakeSystem(prefersDark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    matches: prefersDark,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
  };
  return {
    matchMedia: (text: string) => (text === DARK_SCHEME_QUERY ? (query as unknown as MediaQueryList) : undefined),
    change(next: boolean) {
      query.matches = next;
      for (const listener of listeners) listener({ matches: next } as MediaQueryListEvent);
    },
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  };
}

const unreadableStorage = {
  getItem: (): string | null => {
    throw new DOMException("blocked", "SecurityError");
  },
  setItem: (): void => {
    throw new DOMException("blocked", "SecurityError");
  },
};

function environment(system: ReturnType<typeof fakeSystem>, storage: ThemeEnvironment["storage"]): ThemeEnvironment {
  const root = document.createElement("html");
  return { storage, matchMedia: system.matchMedia, documentElement: () => root };
}

function Shell({ env }: { env: ThemeEnvironment }) {
  const { theme, toggle } = useStandaloneTheme(env);
  return (
    <div data-testid="shell" data-theme={theme}>
      <ThemeToggle theme={theme} onToggle={toggle} />
    </div>
  );
}

const shellTheme = () => screen.getByTestId("shell").getAttribute("data-theme");

describe("the standalone theme", () => {
  it("follows a system that prefers dark when no choice is stored", () => {
    const env = environment(fakeSystem(true), () => memoryStorage());
    render(<Shell env={env} />);
    expect(shellTheme()).toBe("dark");
    expect(env.documentElement()?.getAttribute(THEME_ATTRIBUTE)).toBe("dark");
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps a stored choice over the system preference", () => {
    const storage = memoryStorage({ [THEME_STORAGE_KEY]: "light" });
    render(<Shell env={environment(fakeSystem(true), () => storage)} />);
    expect(shellTheme()).toBe("light");
  });

  it("follows a system change while no choice is stored, and not after one", () => {
    const system = fakeSystem(false);
    const storage = memoryStorage();
    render(<Shell env={environment(system, () => storage)} />);
    expect(shellTheme()).toBe("light");

    act(() => system.change(true));
    expect(shellTheme()).toBe("dark");

    fireEvent.click(screen.getByTestId("theme-toggle"));
    expect(shellTheme()).toBe("light");
    expect(storage.values.get(THEME_STORAGE_KEY)).toBe("light");

    act(() => system.change(false));
    act(() => system.change(true));
    expect(shellTheme()).toBe("light");
  });

  it("follows the system and still toggles when storage cannot be read or written", () => {
    render(<Shell env={environment(fakeSystem(true), () => unreadableStorage)} />);
    expect(shellTheme()).toBe("dark");

    expect(() => fireEvent.click(screen.getByTestId("theme-toggle"))).not.toThrow();
    expect(shellTheme()).toBe("light");
  });

  it("follows the system when reaching storage throws", () => {
    const env = environment(fakeSystem(false), () => {
      throw new DOMException("blocked", "SecurityError");
    });
    render(<Shell env={env} />);
    expect(shellTheme()).toBe("light");
  });
});
