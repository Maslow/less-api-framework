import { useState } from "react";
import React from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useColorMode,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import clsx from "clsx";
import { t } from "i18next";

import JSONEditor from "@/components/Editor/JSONEditor";
import SearchableSelect from "@/components/SearchableSelect";
import { COLOR_MODE } from "@/constants";

import { useCollectionListQuery, useCreateRulesMutation } from "../../service";

import policyTemplate from "./policyTemplate";

const AddRulesModal = (props: {
  children: React.ReactElement;
  onSuccessSubmit: (data: any) => void;
}) => {
  type FormData = {
    collectionName: string;
    value: string;
  };
  const {
    register,
    handleSubmit,
    setFocus,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({});

  const createRulesMutation = useCreateRulesMutation();
  const collectionListQuery = useCollectionListQuery();
  const [parseError, setParseError] = useState<string | undefined>("");
  const [error, setError] = useState<string | undefined>("");

  const onSubmit = async (data: any) => {
    try {
      JSON.parse(data.value);
      setParseError("");
    } catch (errors) {
      setParseError(errors?.toString());
      return;
    }
    try {
      const res = await createRulesMutation.mutateAsync(data);
      if (!res.error) {
        props.onSuccessSubmit(res.data);
        onClose();
      }
    } catch (errors) {
      setError(errors?.toString());
      return;
    }
  };

  const { isOpen, onOpen, onClose } = useDisclosure();
  const { colorMode } = useColorMode();
  const darkMode = colorMode === COLOR_MODE.dark;

  return (
    <>
      {React.cloneElement(props.children, {
        onClick: () => {
          onOpen();
          setError("");
          setParseError("");
          reset({
            collectionName: collectionListQuery?.data?.data[0]?.name,
            value: JSON.stringify(policyTemplate, null, 2),
          });
          setTimeout(() => setFocus("collectionName"), 0);
        },
      })}

      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("Add") + t("CollectionPanel.Policy")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={6} align="flex-start">
              <p className="text-error-600">{error}</p>
              <FormControl isInvalid={!!errors?.collectionName}>
                <FormLabel htmlFor="collectionName">
                  {t("CollectionPanel.SelectCollection")}
                </FormLabel>
                <SearchableSelect
                  {...register("collectionName", {
                    required: "collectionName is required",
                  })}
                  options={collectionListQuery?.data?.data || []}
                  placeholder={
                    collectionListQuery?.data?.data?.length
                      ? undefined
                      : (t("CollectionPanel.NoCollections") as string)
                  }
                  id="collectionName"
                  variant="filled"
                  error={!!errors?.collectionName}
                />
                <FormErrorMessage>
                  {errors.collectionName && errors.collectionName.message}
                </FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!parseError}>
                <FormLabel htmlFor="value"> {t("CollectionPanel.RulesContent")}</FormLabel>
                <FormErrorMessage className="mb-4">{parseError}</FormErrorMessage>
                <Controller
                  name="value"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <div
                      className={clsx("h-[280px]  rounded pr-2", {
                        "bg-lafWhite-400": !darkMode,
                        "bg-lafDark-300": darkMode,
                      })}
                    >
                      <JSONEditor colorMode={colorMode} value={value} onChange={onChange} />
                    </div>
                  )}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              isLoading={createRulesMutation.isLoading}
              type="submit"
              onClick={handleSubmit(onSubmit)}
            >
              {t("Confirm")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

AddRulesModal.displayName = "AddRulesModal";

export default AddRulesModal;
