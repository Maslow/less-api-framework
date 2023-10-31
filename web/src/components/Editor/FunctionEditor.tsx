import { CSSProperties, useEffect, useMemo, useRef } from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { buildWorkerDefinition } from "monaco-editor-workers";

import { COLOR_MODE, Pages } from "@/constants";

import "./userWorker";

import { createUrl, createWebSocketAndStartClient } from "./LanguageClient";

import useHotKey, { DEFAULT_SHORTCUTS } from "@/hooks/useHotKey";
import useGlobalStore from "@/pages/globalStore";
buildWorkerDefinition(
  "../../../node_modules/monaco-editor-workers/dist/workers/",
  new URL("", window.location.href).href,
  false,
);

// monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
//   target: monaco.languages.typescript.ScriptTarget.ESNext,
//   allowNonTsExtensions: true,
//   moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
//   module: monaco.languages.typescript.ModuleKind.CommonJS,
//   /**
//    * This option is required to enable the synthetic default imports.
//    * Support for `import dayjs from 'dayjs'` instead of `import * as dayjs from 'dayjs'`.
//    * This only affects the editor, not the actual compilation.
//    */
//   allowSyntheticDefaultImports: true,
//   noEmit: true,
//   allowJs: false,
//   sourceMap: true,
//   noImplicitAny: false,
// });

// monaco?.editor.defineTheme("lafEditorTheme", {
//   base: "vs",
//   inherit: true,
//   rules: [
//     {
//       foreground: "#008189",
//       token: "keyword",
//     },
//   ],
//   colors: {
//     "editorLineNumber.foreground": "#aaa",
//     "editorOverviewRuler.border": "#fff",
//     "editor.lineHighlightBackground": "#F7F8FA",
//     "scrollbarSlider.background": "#E8EAEC",
//     "editorIndentGuide.activeBackground": "#fff",
//     "editorIndentGuide.background": "#eee",
//   },
// });

// monaco?.editor.defineTheme("lafEditorThemeDark", {
//   base: "vs-dark",
//   inherit: true,
//   rules: [
//     {
//       foreground: "65737e",
//       token: "punctuation.definition.comment",
//     },
//   ],
//   colors: {
//     // https://github.com/microsoft/monaco-editor/discussions/3838
//     "editor.foreground": "#ffffff",
//     "editor.background": "#202631",
//     "editorIndentGuide.activeBackground": "#fff",
//     "editorIndentGuide.background": "#eee",
//     "editor.selectionBackground": "#101621",
//     "menu.selectionBackground": "#101621",
//     "dropdown.background": "#1a202c",
//     "dropdown.foreground": "#f0f0f0",
//     "dropdown.border": "#fff",
//     "quickInputList.focusBackground": "#1a202c",
//     "editorWidget.background": "#1a202c",
//     "editorWidget.foreground": "#f0f0f0",
//     "editorWidget.border": "#1a202c",
//     "input.background": "#1a202c",
//     "list.hoverBackground": "#2a303c",
//   },
// });

const updateModel = (path: string, value: string, editorRef: any) => {
  const newModel =
    monaco.editor.getModel(monaco.Uri.file(path)) ||
    monaco.editor.createModel(value, "typescript", monaco.Uri.file(path));

  if (editorRef.current?.getModel() !== newModel) {
    editorRef.current?.setModel(newModel);
  }
};

function FunctionEditor(props: {
  value: string;
  className?: string;
  style?: CSSProperties;
  onChange?: (value: string | undefined) => void;
  path: string;
  height?: string;
  colorMode?: string;
  readOnly?: boolean;
  fontSize?: number;
}) {
  const {
    value,
    onChange,
    path,
    height = "100%",
    className,
    style = {},
    colorMode = COLOR_MODE.light,
    readOnly = false,
    fontSize = 14,
  } = props;

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>();
  const subscriptionRef = useRef<monaco.IDisposable | undefined>(undefined);
  const monacoEl = useRef(null);
  const hostname = "localhost";
  const path1 = "";
  const port = 30000;
  const url = useMemo(() => createUrl(hostname, port, path1), [hostname, port, path1]);
  // let lspWebSocket: WebSocket;
  const globalStore = useGlobalStore((state) => state);

  useHotKey(
    DEFAULT_SHORTCUTS.send_request,
    () => {
      // format
      editorRef.current?.trigger("keyboard", "editor.action.formatDocument", {});
    },
    {
      enabled: globalStore.currentPageId === Pages.function,
    },
  );

  useEffect(() => {
    if (monacoEl && !editorRef.current) {
      const start = async () => {
        editorRef.current = monaco.editor.create(monacoEl.current!, {
          minimap: {
            enabled: false,
          },
          readOnly: readOnly,
          language: "typescript",
          automaticLayout: true,
          scrollbar: {
            verticalScrollbarSize: 4,
            horizontalScrollbarSize: 8,
          },
          formatOnPaste: true,
          overviewRulerLanes: 0,
          lineNumbersMinChars: 4,
          fontSize: fontSize,
          theme: colorMode === COLOR_MODE.dark ? "lafEditorThemeDark" : "lafEditorTheme",
          scrollBeyondLastLine: false,
        });
        updateModel(path, value, editorRef);

        // lspWebSocket = createWebSocketAndStartClient(url);
        createWebSocketAndStartClient(url);
      };
      start();

      // window.onbeforeunload = () => {
      //   // On page reload/exit, close web socket connection
      //   lspWebSocket?.close();
      // };
      // return () => {
      //     // On component unmount, close web socket connection
      //     lspWebSocket?.close();
      // };
    }

    return () => {};
  }, [colorMode, path, readOnly, value, fontSize, url]);

  // onChange
  useEffect(() => {
    subscriptionRef.current?.dispose();
    if (onChange) {
      subscriptionRef.current = editorRef.current?.onDidChangeModelContent((event) => {
        onChange(editorRef.current?.getValue());
      });
    }
  }, [onChange]);

  return <div style={{ height: height, ...style }} className={className} ref={monacoEl}></div>;
}

export default FunctionEditor;
