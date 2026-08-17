import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, type Component, truncateToWidth } from "@earendil-works/pi-tui";

import { loadProviderConfig, setProviderEnabled } from "./config.ts";

/** A provider that can be toggled with the /local-ai command. */
interface SupportedProvider {
  /** Config key used in pi-local-llm.json. */
  id: string;
  /** Human-friendly name shown in the toggle list. */
  label: string;
}

/** All providers this plugin can register, in display order. */
const SUPPORTED_PROVIDERS: SupportedProvider[] = [
  { id: "ollama", label: "Ollama" },
  { id: "osaurus", label: "Osaurus" },
  { id: "lmstudio", label: "LM Studio" },
  { id: "omlx", label: "OMLX" },
];

/** One row in the /local-ai toggle list. */
interface MultiSelectEntry {
  id: string;
  label: string;
  checked: boolean;
}

/**
 * Minimal multi-select list for the /local-ai command.
 *
 * Keys: up/down move the cursor, space toggles the row under the cursor,
 * Enter calls `onSelect` with the final entries, Escape calls `onCancel`.
 */
class MultiSelect implements Component {
  private cursor = 0;
  private cachedWidth?: number;
  private cachedLines?: string[];

  /** Called on Enter with the entries in their final checked state. */
  onSelect?: (entries: MultiSelectEntry[]) => void;
  /** Called on Escape; the caller should discard any changes. */
  onCancel?: () => void;

  constructor(
    private entries: MultiSelectEntry[],
    private theme: Theme,
  ) {}

  /** Clear the render cache so the next render reflects state changes. */
  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up) && this.cursor > 0) {
      this.cursor -= 1;
      this.invalidate();
    } else if (matchesKey(data, Key.down) && this.cursor < this.entries.length - 1) {
      this.cursor += 1;
      this.invalidate();
    } else if (matchesKey(data, Key.space)) {
      this.entries[this.cursor].checked = !this.entries[this.cursor].checked;
      this.invalidate();
    } else if (matchesKey(data, Key.enter)) {
      this.onSelect?.(this.entries);
    } else if (matchesKey(data, Key.escape)) {
      this.onCancel?.();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines = [this.theme.fg("accent", truncateToWidth("Local AI providers", width))];
    for (const [index, entry] of this.entries.entries()) {
      const prefix = index === this.cursor ? "> " : "  ";
      const state = entry.checked ? "☑" : "☐";
      const line = truncateToWidth(`${prefix}${state} ${entry.label}`, width);
      lines.push(index === this.cursor ? this.theme.fg("accent", line) : line);
    }
    lines.push(
      this.theme.fg("dim", truncateToWidth("space: toggle • enter: save • esc: cancel", width)),
    );

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }
}

/**
 * Registers the /local-ai command, an interactive multi-select list for
 * toggling provider `enabled` flags in the shared pi-local-llm.json config.
 *
 * Providers are registered at pi start, so toggles take effect after the next
 * pi start (noted to the user on save).
 */
const localAi = async function (pi: ExtensionAPI) {
  pi.registerCommand("local-ai", {
    description: "Toggle local AI providers on/off",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("local-ai: requires interactive TUI mode", "warning");
        return;
      }

      const entries = SUPPORTED_PROVIDERS.map((provider) => ({
        id: provider.id,
        label: provider.label,
        checked: loadProviderConfig(provider.id)?.enabled === true,
      }));

      const result = await ctx.ui.custom<MultiSelectEntry[] | null>(
        (tui, theme, _keybindings, done) => {
          const list = new MultiSelect(entries, theme);
          list.onSelect = (selected) => done(selected);
          list.onCancel = () => done(null);

          return {
            render: (width: number) => list.render(width),
            handleInput: (data: string) => {
              list.handleInput(data);
              tui.requestRender();
            },
            invalidate: () => list.invalidate(),
          };
        },
      );

      if (result === null) {
        ctx.ui.notify("local-ai: cancelled, no changes saved", "info");
        return;
      }

      for (const entry of result) {
        setProviderEnabled(entry.id, entry.checked);
      }

      const enabled = result.filter((entry) => entry.checked).map((entry) => entry.label);
      ctx.ui.notify(
        enabled.length > 0
          ? `local-ai: enabled ${enabled.join(", ")}`
          : "local-ai: all providers disabled",
        "info",
      );
      ctx.ui.notify("local-ai: changes apply to providers registered at next pi start", "warning");
    },
  });
};

export default localAi;
export { localAi };
