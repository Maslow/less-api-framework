/****************************
 * cloud functions list sidebar
 ***************************/

import React, { DragEventHandler, useCallback, useEffect, useMemo, useState } from "react";
import { useContextMenu } from "react-contexify";
import { useNavigate, useParams } from "react-router-dom";
import { AddIcon, Search2Icon } from "@chakra-ui/icons";
import {
  Badge,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  useColorMode,
  useToast,
} from "@chakra-ui/react";
import { clsx } from "clsx";
import { t } from "i18next";
import { cloneDeep } from "lodash";

import {
  ApiIcon,
  EditIconLine,
  LinkIcon,
  RecycleBinIcon,
  RecycleDeleteIcon,
  TriggerIcon,
} from "@/components/CommonIcon";
import ConfirmButton from "@/components/ConfirmButton";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import CopyText from "@/components/CopyText";
import EmptyBox from "@/components/EmptyBox";
import FileTypeIcon, { FileType } from "@/components/FileTypeIcon";
import IconText from "@/components/IconText";
import IconWrap from "@/components/IconWrap";
import MoreButton from "@/components/MoreButton";
import Panel from "@/components/Panel";
import SectionList from "@/components/SectionList";
import { COLOR_MODE, Pages } from "@/constants";

import {
  useDeleteFunctionMutation,
  useFunctionListQuery,
  useUpdateFunctionMutation,
} from "../../service";
import useFunctionStore from "../../store";
import TriggerModal from "../TriggerModal";

import ContextMenu from "./ContextMenu";
import CreateModal from "./CreateModal";

import "./index.css";

import { TFunction, TFunctionNode } from "@/apis/typing";
import useFunctionCache from "@/hooks/useFunctionCache";
import RecycleBinModal from "@/pages/app/functions/mods/RecycleBinModal";
import useCustomSettingStore from "@/pages/customSetting";
import useGlobalStore from "@/pages/globalStore";

type TagItem = {
  tagName: string;
  selected: boolean;
};

function pruneTree(node: TFunctionNode, data: TFunction[]): void {
  node.children = node.children.filter((child) => pruneChildTree(child, data));
}

function pruneChildTree(node: TFunctionNode, data: TFunction[]): boolean {
  if (!node.children || node.children.length === 0) {
    return data.some((item) => item.name === node.name);
  }
  node.children = node.children.filter((child) => pruneChildTree(child, data));
  return node.children.length > 0 || data.some((item) => item.name === node.name);
}

// get function dir not ended with /
function getFunctionDir(funcName: string, isFuncDir: "true" | "false" = "false") {
  if (isFuncDir === "true" && funcName !== "" && !funcName.endsWith("/")) funcName += "/";
  if (isFuncDir === "false" && funcName.endsWith("/"))
    funcName = funcName.slice(0, funcName.length - 1);

  const funcNameSplit = funcName.split("/");
  funcNameSplit.pop();
  return funcNameSplit.join("/");
}

export default function FunctionList() {
  const {
    setCurrentFunction,
    currentFunction,
    setAllFunctionList,
    allFunctionList,
    recentFunctionList,
    setRecentFunctionList,
  } = useFunctionStore((store) => store);

  const functionCache = useFunctionCache();
  const [functionRoot, setFunctionRoot] = useState<TFunctionNode>({
    _id: "",
    name: "",
    level: 0,
    isExpanded: true,
    children: [],
  });

  const [keywords, setKeywords] = useState("");

  const { colorMode } = useColorMode();
  const darkMode = colorMode === COLOR_MODE.dark;

  const { currentApp, showSuccess } = useGlobalStore();
  const { commonSettings } = useCustomSettingStore();

  const { id: functionName } = useParams();
  const navigate = useNavigate();
  const [tagsList, setTagsList] = useState<TagItem[]>([]);

  const [currentTag, setCurrentTag] = useState<TagItem | null>(null);

  const { show, hideAll } = useContextMenu();

  const generateRoot = useCallback(
    (data: TFunction[]) => {
      const root = cloneDeep(functionRoot);
      data.forEach((item) => {
        const nameParts = item.name.split("/");
        let currentNode = root;
        nameParts.forEach((_, index) => {
          const isFinalPart = index === nameParts.length - 1;
          const existingItemIndex = currentNode.children.findIndex((node) => node.name === item.name);
          if (existingItemIndex !== -1) {
              currentNode.children[existingItemIndex] = item;
              return;
          } else if (isFinalPart) {
              currentNode.children.push(item);
              return;
          }
          const name = nameParts.slice(0, index + 1).join("/");
          let existingNode = currentNode.children.find(
              (node) => node.name === name && node.level === index,
          );
          if (!existingNode) {
            existingNode = {
              _id: item._id,
              name,
              level: index,
              isExpanded: false,
              children: [],
            };
            currentNode.children.push(existingNode);
          }
          currentNode = existingNode;
        });
      });
      pruneTree(root, data);
      return root;
    },
    [functionRoot],
);

  const filterFunctions = useMemo(() => {
    const res = generateRoot(
      allFunctionList.filter((item: any) => {
        let flag = item?.name.includes(keywords);
        if (tagsList.length > 0 && currentTag) {
          flag = flag && item.tags.includes(currentTag?.tagName);
        }
        return flag;
      }),
    );
    return res.children;
  }, [generateRoot, allFunctionList, keywords, tagsList, currentTag]);

  const [draggedFunc, setDraggedFunc] = useState<{
    func: string;
    isFuncDir: "true" | "false";
  } | null>(null);

  useFunctionListQuery({
    onSuccess: (data) => {
      setAllFunctionList(data.data);
      setFunctionRoot(generateRoot(data.data));
      const tags = data.data.reduce((pre: any, item: any) => {
        return pre.concat(item.tags);
      }, []);
      let newTags: TagItem[] = Array.from(new Set(tags)).map((tagName: any) => {
        const oldTag = tagsList.filter((tag) => tag.tagName === tagName);
        return oldTag.length > 0
          ? oldTag[0]
          : {
              tagName: tagName,
              selected: false,
            };
      });
      setTagsList(newTags);

      if (!recentFunctionList.length && data.data.length > 0) {
        const currentFunction =
          data.data.find((item: TFunction) => item.name === functionName) || data.data[0];
        setCurrentFunction(currentFunction);
        setRecentFunctionList([currentFunction]);
        navigate(`/app/${currentApp?.appid}/${Pages.function}/${currentFunction?.name}`, {
          replace: true,
        });
      }
    },
  });

  useEffect(() => {
    setRecentFunctionList([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      // clear current function
      setCurrentFunction({});
    };
  }, [setCurrentFunction]);

  const deleteFunctionMutation = useDeleteFunctionMutation();

  const renderSelectedTags = () => {
    return tagsList.length > 0 ? (
      <div className="mb-2 flex w-full min-w-[200px] flex-wrap items-center justify-start border-b pb-1">
        <p className={clsx("mb-1 mr-2", darkMode ? "text-white-500" : "text-grayModern-500")}>
          {t("FunctionPanel.Tags")}
        </p>
        {tagsList.map((item) => (
          <span
            className={clsx(
              "mb-1 mr-1 cursor-pointer rounded px-2",
              darkMode ? "bg-gray-700" : "bg-gray-100",
              {
                "!bg-primary-400 text-white": item.tagName === currentTag?.tagName,
              },
            )}
            key={item.tagName}
            onClick={() => setCurrentTag(currentTag?.tagName === item.tagName ? null : item)}
          >
            {item.tagName}
          </span>
        ))}
      </div>
    ) : null;
  };

  function renderSectionItems(items: TFunctionNode[], isFuncList = false) {
    const sortedItems = [...items].sort((a, b) => {
      const isFolderA = a.children && a.children.length > 0;
      const isFolderB = b.children && b.children.length > 0;
      if (isFolderA && !isFolderB) {
        return -1;
      } else if (!isFolderA && isFolderB) {
        return 1;
      }
      return 0;
    });

    return sortedItems.map((item, index) => {
      let fileType = FileType.ts;
      if (item.isExpanded) {
        fileType = FileType.folderOpen;
      } else if (item.children?.length) {
        fileType = FileType.folder;
      }
      const nameParts = item.name.split("/");
      const level = item.level || nameParts.length - 1;
      const itemDisplay = (() => {
        if (
          item.children?.length ||
          isFuncList ||
          commonSettings.funcListDisplay === "name" ||
          !item.desc
        ) {
          return <span className="select-none">{nameParts[nameParts.length - 1]}</span>;
        } else if (commonSettings.funcListDisplay === "desc") {
          return <span className="select-none">{item.desc}</span>;
        } else if (commonSettings.funcListDisplay === "desc-name") {
          return (
            <span className="flex select-none items-center">
              <span>{item.desc}</span>
              <div className="ml-1 translate-y-[1px] scale-[.85] opacity-75">{` ${
                nameParts[nameParts.length - 1]
              }`}</div>
            </span>
          );
        } else {
          return (
            <span className="flex select-none items-center">
              <span>{nameParts[nameParts.length - 1]}</span>
              <div className="ml-1 translate-y-[1px] scale-[.85] opacity-75">{` ${item.desc}`}</div>
            </span>
          );
        }
      })();

      const onDragStart: DragEventHandler<HTMLLIElement> = (e) => {
        const container = e.currentTarget?.parentElement;
        if (!container) return;
        const dataset = (e.target as any).dataset;
        if (!dataset || !dataset.func) return;

        const el = document.createElement("div");
        el.textContent = dataset.func;
        el.className =
          "border border-green-500 rounded-lg py-1 px-2 font-medium tracking-wide max-w-fit";
        container.appendChild(el);
        setDraggedFunc(dataset);
        e.dataTransfer.setDragImage(el, -10, -10);

        setTimeout(() => {
          container.removeChild(el);
        }, 0);
      };

      return (
        <React.Fragment key={index}>
          <SectionList.Item
            isActive={item.name === currentFunction?.name && !item.children?.length}
            key={index as any}
            className={clsx(
              "group hover:!text-primary-700",
              darkMode ? "text-grayIron-200" : " text-grayIron-700",
              item.name === currentFunction?.name && !item.children?.length && "!text-primary-700",
              dragOverFuncDir !== null &&
                ((item.children?.length && (item.name + "/").startsWith(dragOverFuncDir)) ||
                  (!item.children?.length && item.name.startsWith(dragOverFuncDir))) &&
                "!text-primary-700",
              "!mb-0 pb-[2px]",
              dragOverFuncDir !== null &&
                ((item.children?.length && (item.name + "/").startsWith(dragOverFuncDir)) ||
                  (!item.children?.length && item.name.startsWith(dragOverFuncDir))) &&
                "bg-[#f9f9f9]",
            )}
            onClick={() => {
              if (!item.children?.length) {
                setCurrentFunction(item);
                if (!recentFunctionList.map((item) => item._id).includes(item._id)) {
                  setRecentFunctionList([item as unknown as TFunction, ...recentFunctionList]);
                }
                navigate(`/app/${currentApp?.appid}/${Pages.function}/${item.name}`, {
                  replace: true,
                });
              } else {
                item.isExpanded = !item.isExpanded;
                setFunctionRoot({ ...functionRoot });
              }
            }}
            draggable
            onDragStart={onDragStart}
            data-func={item.name}
            data-is-func-dir={!!item.children?.length}
            onContextMenu={(e) => {
              const sidebarWidth =
                JSON.parse(localStorage.getItem("laf_custom_setting") || "").state.layoutInfo
                  .functionPage.SideBar.style.width || 0;
              if (!!item.children?.length) return;
              if (e.clientX > sidebarWidth - 120) {
                show({
                  event: e,
                  id: item._id,
                  position: {
                    x: e.clientX - 120,
                    y: e.clientY,
                  },
                });
              } else {
                show({ event: e, id: item._id });
              }
            }}
          >
            <div
              className="flex items-center overflow-hidden text-ellipsis whitespace-nowrap font-medium"
              style={{
                marginLeft: !isFuncList ? `${0.35 * level}rem` : 0,
              }}
            >
              <FileTypeIcon type={fileType} width="12px" />
              <span style={{ fontSize: commonSettings.fontSize - 2, marginLeft: "0.4rem" }}>
                {itemDisplay}
              </span>
            </div>
            {!item.children?.length && (
              <HStack spacing={1}>
                {functionCache.getCache(item?._id, (item as any)?.source?.code) !==
                  (item as any)?.source?.code && (
                  <span className="mt-[1px] inline-block h-1 w-1 flex-none rounded-full bg-rose-500"></span>
                )}
                <MoreButton isHidden={item.name !== currentFunction?.name} label={t("Operation")}>
                  <>
                    <CreateModal functionItem={item} tagList={tagsList}>
                      <IconText
                        icon={
                          <div className="flex h-full items-center">
                            <EditIconLine />
                          </div>
                        }
                        text={t("Edit")}
                      />
                    </CreateModal>
                    <ConfirmButton
                      onSuccessAction={async () => {
                        const res = await deleteFunctionMutation.mutateAsync(item);
                        if (!res.error) {
                          showSuccess(t("DeleteSuccess"));
                        }
                      }}
                      headerText={String(t("Delete"))}
                      bodyText={String(t("FunctionPanel.DeleteConfirm"))}
                    >
                      <IconText
                        icon={<RecycleDeleteIcon fontSize={16} />}
                        text={t("Delete")}
                        className="hover:!text-error-600"
                      />
                    </ConfirmButton>
                    <CopyText text={`${currentApp.origin}/${item.name}`} hideToolTip>
                      <IconText
                        icon={
                          <div className="flex h-5 items-center">
                            <LinkIcon fontSize={22} />
                          </div>
                        }
                        text={t("Copy")}
                        className="hover:!text-primary-400"
                      />
                    </CopyText>
                  </>
                </MoreButton>
              </HStack>
            )}
          </SectionList.Item>
          {item._id && (
            <ContextMenu
              functionItem={item as unknown as TFunction}
              tagsList={tagsList.map((item) => item.tagName)}
              hideAll={hideAll}
            />
          )}
          {item.isExpanded && item?.children?.length && renderSectionItems(item.children)}
        </React.Fragment>
      );
    });
  }

  const updateFunctionMutation = useUpdateFunctionMutation();
  const toast = useToast();
  const confirmDialog = useConfirmDialog();
  const [dragOverFuncDir, setDragOverFuncDir] = useState<string | null>(null);

  const renameFunction = useCallback(
    async (oldName: string, targetDirOrNewName: string, isNewName = false) => {
      const func = allFunctionList.find((v) => v.name === oldName);
      if (!func) return;

      let newName = targetDirOrNewName;
      if (!isNewName) {
        let targetDir = targetDirOrNewName;
        if (targetDir !== "" && !targetDir.endsWith("/")) targetDir += "/";

        const funcName = oldName.split("/").pop();
        newName = targetDir + funcName;
      }

      const res = await updateFunctionMutation.mutateAsync({
        name: func.name,
        description: func.desc,
        websocket: func.websocket,
        methods: func.methods,
        code: func.source.code,
        tags: func.tags,
        newName,
      });
      if (res.error) return;

      setRecentFunctionList(
        recentFunctionList.map((item: any) => {
          if (item.name === oldName) {
            return { ...item, name: newName };
          }
          return item;
        }),
      );
      if (currentFunction.name === oldName) {
        setCurrentFunction({ ...currentFunction, name: newName });
      }
    },
    [allFunctionList, currentFunction, recentFunctionList],
  );

  const renameFunctionDir = useCallback(
    async (srcDir: string, targetDir: string) => {
      if (srcDir !== "" && !srcDir.endsWith("/")) srcDir += "/";
      if (targetDir !== "" && !targetDir.endsWith("/")) targetDir += "/";

      let dir = getFunctionDir(srcDir, "false");
      if (dir !== "") dir += "/";
      const funcs = allFunctionList.filter((func) => func.name.startsWith(srcDir));

      return await Promise.allSettled(
        funcs.map(async (v) => {
          const newFuncName = targetDir + v.name.slice(dir.length);
          return await renameFunction(v.name, newFuncName, true);
        }),
      );
    },
    [allFunctionList, renameFunction],
  );

  const onDrop: React.DragEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (!draggedFunc) return;
      const { func: srcFunc, isFuncDir: srcIsFuncDir } = draggedFunc;

      // find target position
      let target = e.target as any;
      while (target && !("func" in target.dataset)) {
        if (target.id === "func-list") {
          // out of search range
          target = null;
          break;
        }
        target = target.parentElement;
      }

      const handleMoveToRootDir = () => {
        // from root dir to root dir
        if (!srcFunc.includes("/")) return;

        confirmDialog.show({
          headerText: String(t("MoveFunction")),
          bodyText: String(
            t("FunctionPanel.MoveFunctionToRootTip", {
              srcFunc,
            }),
          ),
          onConfirm: () => {
            const toastId = toast({
              title: String(t("FunctionPanel.MovingFunction")),
              status: "loading",
              duration: null,
              position: "top-left",
            });
            const task =
              srcIsFuncDir === "true"
                ? renameFunctionDir(srcFunc, "")
                : renameFunction(srcFunc, "");

            task.finally(() => toast.close(toastId));
          },
          confirmButtonText: String(t("Confirm")),
        });
        return;
      };

      // root dir
      if (!target) {
        return handleMoveToRootDir();
      }

      const { func: targetFunc, isFuncDir } = target.dataset;
      // same file or file
      if (targetFunc === srcFunc && isFuncDir === srcIsFuncDir) return;

      let targetDir = getFunctionDir(targetFunc, isFuncDir);
      if (targetDir === "") {
        return handleMoveToRootDir();
      }

      const srcFuncDir = getFunctionDir(srcFunc, srcIsFuncDir);
      // not to root
      // not to drag a dir to its inner dir
      // not to drag a file to the same dir
      if (
        targetDir &&
        !(
          (srcIsFuncDir === "true" && targetDir.startsWith(srcFuncDir)) ||
          (srcIsFuncDir === "true" && targetDir === getFunctionDir(srcFunc, "false")) ||
          (srcIsFuncDir !== "true" && srcFuncDir === targetDir)
        )
      ) {
        targetDir += "/";
        confirmDialog.show({
          headerText: String(t("MoveFunction")),
          bodyText: String(
            t("FunctionPanel.MoveFunctionTip", {
              srcFunc,
              targetDir,
            }),
          ),
          onConfirm: () => {
            const toastId = toast({
              title: String(t("FunctionPanel.MovingFunction")),
              status: "loading",
              duration: null,
              position: "top-left",
            });
            const task =
              srcIsFuncDir === "true"
                ? renameFunctionDir(srcFunc, targetDir)
                : renameFunction(srcFunc, targetDir);

            task.finally(() => toast.close(toastId));
          },
          confirmButtonText: String(t("Confirm")),
        });
      }
    },
    [renameFunction, renameFunctionDir, draggedFunc],
  );

  const onDragOver: React.DragEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (!draggedFunc) return;
      e.preventDefault();

      // find target position
      let target = e.target as any;
      while (target && !("func" in target.dataset)) {
        if (target.id === "func-list") {
          // out of search range
          target = null;
          break;
        }
        target = target.parentElement;
      }

      if (target) {
        const { isFuncDir, func } = target.dataset;
        let targetDir = getFunctionDir(func, isFuncDir);
        const draggedFuncDir = getFunctionDir(draggedFunc.func, draggedFunc.isFuncDir);
        // same file or dir
        // drag a dir to its inner dir
        // drag a file to the same dir
        if (
          (func === draggedFunc.func && isFuncDir === draggedFunc.isFuncDir) ||
          (draggedFunc.isFuncDir === "true" && targetDir.startsWith(draggedFuncDir)) ||
          (draggedFunc.isFuncDir === "true" &&
            targetDir === getFunctionDir(draggedFunc.func, "false")) ||
          (draggedFunc.isFuncDir !== "true" && draggedFuncDir === targetDir)
        ) {
          setDragOverFuncDir(null);
          return;
        }

        setDragOverFuncDir(!targetDir ? "" : targetDir + "/");
      } else {
        // from root to root
        if (!draggedFunc.func.includes("/")) {
          setDragOverFuncDir(null);
          return;
        }
        // all files and dirs
        setDragOverFuncDir("");
      }
    },
    [draggedFunc],
  );

  return (
    <Panel className="flex-grow overflow-hidden">
      <confirmDialog.Dialog />
      <Panel.Header
        title={
          <div className="flex">
            {t`FunctionPanel.FunctionList`}
            {allFunctionList.length ? (
              <Badge rounded={"full"} ml="1">
                {allFunctionList.length}
              </Badge>
            ) : null}
          </div>
        }
        actions={[
          <RecycleBinModal key="recycle_modal">
            <IconWrap size={20} tooltip={t("RecycleBin").toString()}>
              <RecycleBinIcon color={darkMode ? "white" : "#24282C"} />
            </IconWrap>
          </RecycleBinModal>,
          <CopyText
            key="copy_text"
            text={`${currentApp.origin}/_/api-docs?token=${currentApp.openapi_token}`}
            hideToolTip
          >
            <IconWrap size={20} tooltip={t("FunctionPanel.CopyOpenAPIUrl").toString()}>
              <ApiIcon fontSize={18} />
            </IconWrap>
          </CopyText>,
          <TriggerModal key="trigger_modal">
            <IconWrap size={20} tooltip={t("TriggerPanel.Trigger").toString()}>
              <TriggerIcon fontSize={13} />
            </IconWrap>
          </TriggerModal>,
          <CreateModal key="create_modal" tagList={tagsList}>
            <IconWrap size={20} tooltip={t("FunctionPanel.AddFunction").toString()}>
              <AddIcon fontSize={12} />
            </IconWrap>
          </CreateModal>,
        ]}
      />

      <InputGroup className="my-1.5">
        <InputLeftElement
          height={"6"}
          pointerEvents="none"
          children={<Search2Icon color="gray.300" fontSize={12} />}
        />
        <Input
          size="xs"
          pl={8}
          rounded={"full"}
          placeholder={String(t("FunctionPanel.SearchPlaceholder"))}
          onChange={(e) => {
            setKeywords(e.target.value);
          }}
        />
      </InputGroup>

      {renderSelectedTags()}

      <div className="funcList flex-grow" style={{ overflowY: "auto" }}>
        {keywords || currentTag || functionRoot.children?.length ? (
          <SectionList
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={() => setDragOverFuncDir(null)}
            onDragLeave={() => setDragOverFuncDir(null)}
            id="func-list"
          >
            {keywords || currentTag
              ? renderSectionItems(filterFunctions, true)
              : renderSectionItems(functionRoot.children)}
          </SectionList>
        ) : (
          <EmptyBox hideIcon>
            <p>{t("FunctionPanel.EmptyFunctionTip")}</p>
          </EmptyBox>
        )}
      </div>
    </Panel>
  );
}
