import { useTheme } from "@repo/ui/blocks/theme";
import type * as Monaco from "monaco-editor/editor/editor.api";
import { useEffect, useRef, useState } from "react";

/**
 * The language the wording is actually written in.
 *
 * Not HTML and not Markdown — a message body is prose with `{{name}}` holes in
 * it, and the only thing worth colouring is the holes. Registering a one-rule
 * tokenizer is what makes a mistyped `{{ name}` visibly not a placeholder
 * while it is being typed, which is the whole reason for an editor here.
 */
const LANGUAGE = "tagaroa-wording";

/**
 * The editor core, without a single one of Monaco's bundled languages.
 *
 * Importing `monaco-editor` itself drags TypeScript, CSS, HTML and JSON — four
 * language services and about twelve megabytes of workers — for a field whose
 * entire grammar is `{{name}}`. `editor.api` is the same editor with none of
 * them, and the Monarch tokenizer below is the only language it will know.
 */
const loadMonaco = async (): Promise<typeof Monaco> => {
  const monaco = await import("monaco-editor/editor/editor.api");

  self.MonacoEnvironment ??= {
    getWorker: async () => {
      const { default: Worker } =
        await import("monaco-editor/editor/editor.worker?worker");
      return new Worker();
    },
  };

  return monaco;
};

const register = (monaco: typeof Monaco) => {
  if (monaco.languages.getLanguages().some(({ id }) => id === LANGUAGE)) return;

  monaco.languages.register({ id: LANGUAGE });
  monaco.languages.setMonarchTokensProvider(LANGUAGE, {
    tokenizer: {
      root: [[/\{\{\s*[A-Za-z0-9_]+\s*\}\}/, "variable"]],
    },
  });

  // Two themes rather than one that adapts: Monaco resolves colours once per
  // theme, so following the app's toggle means defining both and switching.
  for (const [name, base, background, foreground] of [
    ["tagaroa-light", "vs", "#fcfaf5", "#1b1f23"],
    ["tagaroa-dark", "vs-dark", "#1b2027", "#eff0f1"],
  ] as const) {
    monaco.editor.defineTheme(name, {
      base,
      colors: {
        "editor.background": background,
        "editor.foreground": foreground,
        "editorLineNumber.foreground": "#8b9096",
      },
      inherit: true,
      rules: [{ fontStyle: "bold", foreground: "00789b", token: "variable" }],
    });
  }
};

export interface CodeEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** A published version is history; the editor shows it without offering to
   * change it. */
  readOnly?: boolean;
  rows?: number;
  ariaLabel?: string;
}

/**
 * Monaco, mounted only in the browser and only while the dialog is open.
 *
 * The import is dynamic because this app server-renders: Monaco reaches for
 * `document` and `navigator` as it loads, so a static import would fail the
 * render rather than the editor. The textarea is what stands here until it
 * arrives, so the field is usable before — and if — Monaco loads at all.
 */
export function CodeEditor({
  ariaLabel,
  id,
  onChange,
  readOnly = false,
  rows = 12,
  value,
}: CodeEditorProps) {
  const { resolved } = useTheme();
  const host = useRef<HTMLDivElement | null>(null);
  const editor = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [ready, setReady] = useState(false);

  // The callback the model's listener holds, kept current without re-creating
  // the editor — a new editor per keystroke would lose the cursor.
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);

  // Keep edits made in the fallback textarea while Monaco is loading.
  const seed = useRef({ ariaLabel, readOnly, value });
  useEffect(() => {
    seed.current = { ariaLabel, readOnly, value };
  }, [ariaLabel, readOnly, value]);

  const height = `${rows * 1.5 + 1}rem`;

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let layoutFrame = 0;

    void (async () => {
      const monaco = await loadMonaco();
      if (disposed || !host.current) return;

      register(monaco);

      const instance = monaco.editor.create(host.current, {
        ariaLabel: seed.current.ariaLabel,
        automaticLayout: false,
        fontFamily:
          '"Geist Mono Variable", ui-monospace, SFMono-Regular, monospace',
        fontSize: 13,
        language: LANGUAGE,
        lineNumbersMinChars: 3,
        minimap: { enabled: false },
        overviewRulerLanes: 0,
        padding: { bottom: 10, top: 10 },
        readOnly: seed.current.readOnly,
        renderLineHighlight: "none",
        scrollBeyondLastLine: false,
        scrollbar: { horizontal: "hidden", verticalScrollbarSize: 8 },
        tabSize: 2,
        value: seed.current.value,
        wordWrap: "on",
      });

      instance.onDidChangeModelContent(() => {
        latest.current(instance.getValue());
      });

      editor.current = instance;
      // Defer layout writes so they cannot trigger another resize in the same delivery.
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(layoutFrame);
        layoutFrame = requestAnimationFrame(() => instance.layout());
      });
      observer.observe(host.current);
      setReady(true);
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      cancelAnimationFrame(layoutFrame);
      editor.current?.dispose();
      editor.current = null;
    };
    // Created once per mount. `value` seeds it; later changes come through the
    // effect below, which does not reset the cursor.
  }, []);

  useEffect(() => {
    editor.current?.updateOptions({ ariaLabel, readOnly });
  }, [ariaLabel, readOnly, ready]);

  useEffect(() => {
    void (async () => {
      const monaco = await loadMonaco();
      monaco.editor.setTheme(
        resolved === "dark" ? "tagaroa-dark" : "tagaroa-light",
      );
    })();
  }, [resolved]);

  return (
    <div
      className="overflow-hidden rounded-md border bg-background"
      style={{ height }}
    >
      <div
        aria-hidden={!ready}
        className="h-full"
        ref={host}
        style={{ display: ready ? "block" : "none" }}
      />
      {ready ? null : (
        <textarea
          aria-label={ariaLabel}
          className="px-3 py-2.5 font-mono h-full w-full resize-none bg-transparent text-[13px] outline-none"
          id={id}
          onChange={(event) => onChange(event.target.value)}
          readOnly={readOnly}
          value={value}
        />
      )}
    </div>
  );
}
