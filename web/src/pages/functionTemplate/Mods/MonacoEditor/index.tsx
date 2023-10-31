import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";

import { EditIconLine, RecycleDeleteIcon } from "@/components/CommonIcon";
import ConfirmButton from "@/components/ConfirmButton";
import { COLOR_MODE } from "@/constants";

// import "@/components/Editor/userWorker";
import "@/components/Editor/theme";

import AddFunctionModal from "../../CreateFuncTemplate/Mods/AddFunctionModal";

import FunctionPopOver from "./FunctionPopover";

const updateModel = (value: string, editorRef: any) => {
  const newModel = monaco.editor.createModel(value, "typescript");
  if (editorRef.current?.getModel() !== newModel) {
    editorRef.current?.setModel(newModel);
  }
};

const MonacoEditor = (props: {
  value: string;
  title?: string;
  readOnly?: boolean;
  colorMode?: string;
  onChange?: (value: string | undefined) => void;
  currentFunction?: any;
  setCurrentFunction?: any;
  functionList?: any;
  setFunctionList?: any;
  popover?: boolean;
}) => {
  const {
    readOnly,
    value,
    title,
    colorMode,
    onChange,
    currentFunction,
    setCurrentFunction,
    functionList,
    setFunctionList,
    popover,
  } = props;
  const monacoEl = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>();
  const subscriptionRef = useRef<monaco.IDisposable | undefined>(undefined);
  const { t } = useTranslation();
  const darkMode = colorMode === COLOR_MODE.dark;

  useEffect(() => {
    if (monacoEl && !editorRef.current) {
      editorRef.current = monaco.editor.create(monacoEl.current!, {
        value: value,
        minimap: {
          enabled: false,
        },
        language: "typescript",
        readOnly: readOnly,
        scrollBeyondLastLine: false,
        scrollbar: {
          verticalScrollbarSize: 4,
          horizontalScrollbarSize: 8,
        },
        mouseWheelScrollSensitivity: 0,
        formatOnPaste: true,
        overviewRulerLanes: 0,
        lineNumbersMinChars: 4,
        fontSize: popover ? 10 : 14,
        fontWeight: popover ? "400" : "450",
        theme: darkMode ? "lafEditorDarkTheme" : "lafEditorTheme",
      });
    }

    updateModel(value, editorRef);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    subscriptionRef.current?.dispose();
    if (onChange) {
      subscriptionRef.current = editorRef.current?.onDidChangeModelContent(() => {
        onChange(editorRef.current?.getValue());
      });
    }
  }, [onChange]);

  useEffect(() => {
    if (monacoEl && editorRef.current) {
      editorRef.current.updateOptions({
        theme: darkMode ? "lafEditorDarkTheme" : "lafEditorTheme",
      });
    }
  }, [darkMode]);

  return (
    <div
      className={clsx(
        "h-full overflow-hidden rounded-md border border-grayModern-200",
        darkMode ? "bg-[#202631]" : "bg-white",
      )}
    >
      <div
        className={clsx(
          "flex h-8 w-full items-center justify-between rounded-t-md px-6 text-lg font-semibold",
          darkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-800",
        )}
        placeholder="Function Name"
        style={{ outline: "none", boxShadow: "none" }}
      >
        <span className="flex items-center">
          {title}
          <span className="ml-3 text-grayIron-600">
            <FunctionPopOver currentFunction={currentFunction} />
          </span>
        </span>
        <span>
          {!readOnly && (
            <span className="flex items-center space-x-4">
              <AddFunctionModal
                functionList={functionList}
                setFunctionList={setFunctionList}
                currentFunction={currentFunction}
                setCurrentFunction={setCurrentFunction}
                isEdit={true}
              >
                <span className="cursor-pointer">
                  <EditIconLine color={darkMode ? "#F4F6F8" : "#24282C"} />
                </span>
              </AddFunctionModal>
              <ConfirmButton
                onSuccessAction={async () => {
                  const updatedFunctionList = functionList.filter(
                    (func: any) => func.name !== currentFunction?.name,
                  );
                  setFunctionList(updatedFunctionList);
                  setCurrentFunction(updatedFunctionList[0]);
                }}
                headerText={String(t("Delete"))}
                bodyText={String(t("FunctionPanel.DeleteConfirm"))}
              >
                <RecycleDeleteIcon
                  fontSize="17"
                  color={darkMode ? "#F4F6F8" : "#24282C"}
                  className="cursor-pointer"
                />
              </ConfirmButton>
            </span>
          )}
        </span>
      </div>
      <div ref={monacoEl} className="mb-2 mt-1 h-[90%] min-h-[300px]" />
    </div>
  );
};

export default MonacoEditor;
