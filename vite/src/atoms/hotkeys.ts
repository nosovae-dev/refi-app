import { isCollection } from "@/utils/common";
import { actionCommitChange } from "./firestore.action";
import { navigatorPathAtom } from "./navigator";
import {
  actionExportDocCSV,
  actionExportDocJSON,
  actionExportViewCSV,
  actionExportViewJSON,
  actionSubmitQuery,
} from "./navigator.action";
import {
  getRecoilExternalLoadable,
  setRecoilExternalState,
} from "./RecoilExternalStatePortal";
import {
  isModalCommandAtom,
  isModalFeedbackAtom,
  isModalNewsAtom,
  isShowDocFinderModalCommandAtom,
  isShowPreviewChangeModalAtom,
} from "./ui";

export type IGlobalHotKeys = Record<
  string,
  {
    name: string;
    group: "navigator" | "action" | "general";
    sequences: string;
    handler: () => void;
  }
>;

export const globalHotKeys: IGlobalHotKeys = {
  // OPEN_DOC_SEARCH: {
  //   name: "Search documents, collections by name",
  //   group: "navigator",
  //   sequences: "command+p",
  // },
  OPEN_COMMAND_LIST: {
    name: "Open command list",
    group: "navigator",
    sequences: "command+shift+p",
    handler: () =>
      setRecoilExternalState(isModalCommandAtom, (value) => !value),
  },
  COMMIT_CHANGES: {
    name: "Commit changes",
    group: "action",
    sequences: "command+s",
    handler: async () => {
      await actionCommitChange();
    },
  },
  PREVIEW_CHANGES: {
    name: "Preview changes",
    group: "action",
    sequences: "command+shift+s", // TODO: Check the right key
    handler: () => {
      setRecoilExternalState(isShowPreviewChangeModalAtom, (value) => !value);
    },
  },
  WHATS_NEWS: {
    name: "What's news",
    group: "general",
    sequences: "",
    handler: () => {
      setRecoilExternalState(isModalNewsAtom, (value) => !value);
    },
  },
  LEAVE_FEEDBACK: {
    name: "Leave Feedback",
    group: "general",
    sequences: "",
    handler: () => {
      setRecoilExternalState(isModalFeedbackAtom, (value) => !value);
    },
  },
  SEND_QUERY: {
    name: "Query",
    group: "action",
    sequences: "command+Enter",
    handler: () => {
      actionSubmitQuery(true);
    },
  },
  EXPORT_QUERY_JSON: {
    name: "Export: Current table as JSON",
    group: "action",
    sequences: "",
    handler: () => {
      actionExportViewJSON();
    },
  },
  EXPORT_QUERY_CSV: {
    name: "Export: Current table as CSV",
    group: "action",
    sequences: "",
    handler: () => {
      actionExportViewCSV();
    },
  },
  EXPORT_DOC_JSON: {
    name: "Export: Current document as JSON",
    group: "action",
    sequences: "",
    handler: async () => {
      const docPath = await getRecoilExternalLoadable(
        navigatorPathAtom
      ).toPromise();
      if (isCollection(docPath)) {
        // TODO: Show error
        return;
      }

      actionExportDocJSON(docPath);
    },
  },
  EXPORT_DOC_CSV: {
    name: "Export: Current document as CSV",
    group: "action",
    sequences: "",
    handler: async () => {
      const docPath = await getRecoilExternalLoadable(
        navigatorPathAtom
      ).toPromise();
      if (isCollection(docPath)) {
        // TODO: Show error
        return;
      }

      actionExportDocCSV(docPath);
    },
  },
};

type IGlobalHotKeysHandler = Record<string, () => void>;

export const globalHotKeysHandler: IGlobalHotKeysHandler = Object.keys(
  globalHotKeys
).reduce((handlers, action) => {
  handlers[action] = globalHotKeys[action].handler;
  return handlers;
}, {});