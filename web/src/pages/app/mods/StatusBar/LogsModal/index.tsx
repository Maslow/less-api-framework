import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Center,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  useColorMode,
  useDisclosure,
} from "@chakra-ui/react";
import { EventStreamContentType, fetchEventSource } from "@microsoft/fetch-event-source";
import { LogViewer, LogViewerSearch } from "@patternfly/react-log-viewer";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";

import { DownIcon, RefreshIcon } from "@/components/CommonIcon";

import "./index.scss";

import { PodControllerGetContainerNameList, PodControllerGetPodNameList } from "@/apis/v1/apps";
import useCustomSettingStore from "@/pages/customSetting";
import useGlobalStore from "@/pages/globalStore";

type Log = {
  data: string;
  event: string;
  id: string;
  retry?: number;
};

const MAX_RETRIES = 5;

export default function LogsModal(props: { children: React.ReactElement }) {
  const { children } = props;
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { t } = useTranslation();
  const settingStore = useCustomSettingStore();
  const { showWarning } = useGlobalStore(({ showWarning }) => ({ showWarning }));

  const { currentApp } = useGlobalStore((state) => state);
  const [podName, setPodName] = useState("");
  const [containerName, setContainerName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [rowNumber, setRowNumber] = useState(0);
  const [paused, setPaused] = useState(false);

  const [logs, setLogs] = useState<Log[]>([]);
  const [renderLogs, setRenderLogs] = useState("");
  const [refresh, setRefresh] = useState(true);
  const retryCountRef = useRef(0);

  const darkMode = useColorMode().colorMode === "dark";

  const { data: podData } = useQuery(
    ["GetPodQuery"],
    () => {
      return PodControllerGetPodNameList({});
    },
    {
      onSuccess: (data) => {
        if (data.data.podNameList) {
          setPodName(data.data.podNameList[0]);
        }
      },
      enabled: isOpen,
    },
  );

  const { data: containerData } = useQuery(
    ["GetContainerQuery"],
    () => {
      return PodControllerGetContainerNameList({ podName });
    },
    {
      onSuccess: (data) => {
        if (data.data.containerNameList) {
          const length = data.data.containerNameList.length;
          setContainerName(data.data.containerNameList[length - 1]);
        }
      },
      enabled: isOpen && !!podName && podName !== "all",
    },
  );

  const fetchLogs = useCallback(() => {
    if (!podName || !containerName) return;
    const ctrl = new AbortController();

    fetchEventSource(
      `/v1/apps/${currentApp.appid}/logs/${podName}?containerName=${containerName}`,
      {
        method: "GET",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        signal: ctrl.signal,
        async onopen(response) {
          if (response.ok && response.headers.get("content-type") === EventStreamContentType) {
            setIsLoading(false);
          } else {
            throw new Error(`Unexpected response: ${response.status} ${response.statusText}`);
          }
        },

        onmessage(msg) {
          if (msg.event === "error") {
            showWarning(msg.data);
          }

          if (msg.event === "log") {
            const newLineCount = (msg.data.match(/\n/g) || []).length;
            setLogs((pre) => [...pre, msg]);
            setRowNumber((prevRowNumber) => prevRowNumber + newLineCount);
            retryCountRef.current = 0;
          }
        },

        onclose() {
          // if the server closes the connection unexpectedly, retry:
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current += 1;
            setRefresh((pre) => !pre);
            setPaused(false);
          }
        },

        onerror(err) {
          showWarning(err.message);
          // auto retry fetch
        },
      },
    );
    return ctrl;
  }, [podName, containerName, currentApp.appid, showWarning]);

  useEffect(() => {
    if (!isOpen) return;
    setLogs([]);
    setIsLoading(true);
    const ctrl = fetchLogs();
    return () => {
      ctrl?.abort();
    };
  }, [podName, containerName, isOpen, refresh, fetchLogs]);

  useEffect(() => {
    const sortedLogs = [...logs].sort((a, b) => parseInt(a.id) - parseInt(b.id));
    const concatenatedLogs = sortedLogs.map((log) => log.data).join("");
    setRenderLogs(concatenatedLogs);
  }, [logs]);

  useEffect(() => {
    retryCountRef.current = 0;
  }, [isOpen]);

  return (
    <>
      {React.cloneElement(children, {
        onClick: () => {
          onOpen();
        },
      })}
      <Modal isOpen={isOpen} onClose={onClose} size={"6xl"}>
        <ModalOverlay />
        <ModalContent className="h-[90vh]" m={"auto"}>
          <ModalHeader>
            <ModalCloseButton />
            <HStack>
              <span>{t("Logs.PodLogs")}</span>
              <span>
                <Select
                  className="ml-4 !h-8 !w-64"
                  onChange={(e) => {
                    setPodName(e.target.value);
                  }}
                  value={podName}
                >
                  {podData?.data?.podNameList &&
                    (podData?.data?.podNameList.length > 1
                      ? ["all", ...podData?.data?.podNameList]
                      : podData?.data?.podNameList
                    ).map((item: string) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                </Select>
              </span>
              {containerData?.data?.containerNameList && (
                <span>
                  <Select
                    className="ml-1 !h-8 !w-32"
                    onChange={(e) => {
                      setContainerName(e.target.value);
                    }}
                    value={containerName}
                  >
                    {...containerData?.data?.containerNameList.map((item: string) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                </span>
              )}
              <span>
                <Button
                  variant={"text"}
                  leftIcon={<RefreshIcon boxSize={5} />}
                  px={2}
                  onClick={() => {
                    setRefresh((pre) => !pre);
                    setPaused(false);
                  }}
                >
                  {t("Refresh")}
                </Button>
              </span>
            </HStack>
          </ModalHeader>
          <ModalBody pr={0} py={0}>
            {isLoading ? (
              <Center className="h-full w-full">
                <Spinner />
              </Center>
            ) : (
              <div
                id="log-viewer-container"
                className="text-sm flex h-full flex-col px-2 font-mono"
                style={{ fontSize: settingStore.commonSettings.fontSize - 1 }}
                onWheel={(e) => {
                  setPaused(true);
                }}
              >
                <LogViewer
                  data={renderLogs}
                  hasLineNumbers={false}
                  scrollToRow={!paused ? rowNumber + 1 : undefined}
                  height={"98%"}
                  onScroll={(e) => {
                    if (e.scrollOffsetToBottom <= 0) {
                      setPaused(false);
                    }
                  }}
                  toolbar={
                    <div className="absolute right-24 top-4">
                      <LogViewerSearch
                        placeholder="Search"
                        minSearchChars={1}
                        className="mr-4 h-8 rounded-lg border pl-4 !text-grayModern-400"
                      />
                    </div>
                  }
                />
                <div className="absolute bottom-1 w-[95%]">
                  {paused && (
                    <HStack
                      onClick={() => {
                        setPaused(false);
                      }}
                      className={clsx(
                        "flex w-full cursor-pointer items-center justify-center",
                        darkMode ? "bg-[#212630]" : "bg-white",
                      )}
                    >
                      <DownIcon color={"#33BAB1"} size={24} />
                      <span className="text-lg font-medium text-primary-500">
                        {t("Logs.ScrollToBottom")}
                      </span>
                    </HStack>
                  )}
                </div>
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
