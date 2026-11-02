import {
  appBasePath,
  appPathFromLocalRoute,
} from "@agent-native/core/client/api-path";
import { useAgentRouteState } from "@agent-native/core/client/navigation";

import {
  chatThreadPath,
  HOME_PATH,
  isChatPathname,
  NEW_CHAT_PATH,
  threadIdFromPath,
} from "@/lib/chat-paths";
import { TAB_ID } from "@/lib/tab-id";

export interface NavigationState {
  view?: string;
  path?: string;
  publicPath?: string;
  threadId?: string;
  activeWorkspaceId?: string | undefined;
  activeHandoverPlanId?: string | undefined;
  selectedFindingIds?: string[] | undefined;
  selectedFindingId?: string | undefined;
  riskStatus?: string | undefined;
  selectedMapNodeId?: string | undefined;
  mapConfirmedOnly?: boolean | undefined;
  mapAllPeople?: boolean | undefined;
  selectedPersonId?: string | undefined;
  activeDocumentPanel?: string | undefined;
  selectedTaskId?: string | undefined;
  selectedStepNumber?: string | undefined;
  selectedRunId?: string | undefined;
  selectedDocumentId?: string | undefined;
}

export function useNavigationState() {
  useAgentRouteState<NavigationState>({
    browserTabId: TAB_ID,
    requestSource: TAB_ID,
    getNavigationState: ({ pathname, searchParams }) => ({
      ...navigationStateForPath(pathname),
      ...(pathname === "/overview" ||
      pathname === "/workspace" ||
      pathname === "/documents" ||
      pathname === "/verification" ||
      pathname === "/tasks" ||
      pathname === "/knowledge-map" ||
      pathname === "/risks" ||
      pathname === "/handover"
        ? {
            activeDocumentPanel: searchParams.get("panel") ?? undefined,
            activeWorkspaceId: searchParams.get("workspaceId") ?? undefined,
            selectedPersonId:
              searchParams.get("personId") === "all"
                ? undefined
                : (searchParams.get("personId") ?? undefined),
            activeHandoverPlanId: searchParams.get("planId") ?? undefined,
            selectedFindingIds: (searchParams.get("findingIds") ?? "")
              .split(",")
              .filter(Boolean)
              .slice(0, 30),
            selectedFindingId: searchParams.get("findingId") ?? undefined,
            riskStatus: searchParams.get("status") ?? undefined,
            selectedMapNodeId: searchParams.get("nodeId") ?? undefined,
            mapConfirmedOnly: searchParams.get("confirmedOnly") === "true",
            mapAllPeople: searchParams.get("personId") === "all",
            selectedTaskId: searchParams.get("taskId") ?? undefined,
            selectedStepNumber: searchParams.get("stepNumber") ?? undefined,
            selectedRunId: searchParams.get("runId") ?? undefined,
            selectedDocumentId: searchParams.get("documentId") ?? undefined,
          }
        : {}),
    }),
    getCommandPath: commandPathForNavigation,
  });
}

export function commandPathForNavigation(command: NavigationState): string {
  const fallbackPath = pathForCommand(command);
  const path = typeof command?.path === "string" ? command.path : "";
  if (!path) return fallbackPath;

  const basePath = appBasePath();
  if (!basePath) return path;

  const suffixIndex = path.search(/[?#]/);
  const pathname = suffixIndex === -1 ? path : path.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : path.slice(suffixIndex);
  const publicPath =
    typeof command?.publicPath === "string" ? command.publicPath : "";
  const publicPathSuffixIndex = publicPath.search(/[?#]/);
  const declaredPublicPath =
    publicPathSuffixIndex === -1
      ? publicPath
      : publicPath.slice(0, publicPathSuffixIndex);
  const publicViewPath = appPathFromLocalRoute(pathForView(command?.view));
  if (
    matchesPathPrefix(pathname, basePath) &&
    (matchesPathPrefix(pathname, publicViewPath) ||
      (declaredPublicPath && declaredPublicPath === pathname))
  ) {
    return `${pathname.slice(basePath.length) || "/"}${suffix}`;
  }
  return path;
}

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function navigationStateForPath(pathname: string): NavigationState {
  const threadId = threadIdFromPath(pathname);
  return {
    view: viewForPath(pathname),
    path: pathname,
    publicPath: appPathFromLocalRoute(pathname),
    ...(threadId ? { threadId } : {}),
  };
}

function viewForPath(pathname: string): string {
  if (pathname === "/overview") return "overview";
  if (pathname === "/handover") return "handover";
  if (pathname === "/risks") return "risks";
  if (pathname === "/knowledge-map") return "knowledge-map";
  if (pathname === "/tasks") return "tasks";
  if (pathname === "/verification") return "verification";
  if (pathname === "/documents") return "documents";
  if (pathname === "/workspace") return "workspace";
  if (isChatPathname(pathname)) return "chat";
  if (pathname === HOME_PATH) return "home";
  if (pathname.startsWith("/database")) return "database";
  if (pathname.startsWith("/extensions")) return "extensions";
  if (pathname.startsWith("/observability")) return "observability";
  if (pathname.startsWith("/settings/agent") || pathname.startsWith("/agent")) {
    return "agent";
  }
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/team")) return "settings";
  return "chat";
}

function pathForView(view?: string): string {
  switch (view) {
    case "overview":
      return "/overview";
    case "handover":
      return "/handover";
    case "risks":
      return "/risks";
    case "knowledge-map":
      return "/knowledge-map";
    case "tasks":
      return "/tasks";
    case "verification":
      return "/verification";
    case "documents":
      return "/documents";
    case "workspace":
      return "/workspace";
    case "chat":
    case "ask":
      return NEW_CHAT_PATH;
    case "home":
      return HOME_PATH;
    case "database":
      return "/database";
    case "extensions":
      return "/extensions";
    case "observability":
      return "/observability";
    case "agent":
      return "/settings/agent";
    case "settings":
      return "/settings";
    case "team":
      return "/settings/organization";
    default:
      return HOME_PATH;
  }
}

export function pathForCommand(command: any): string {
  const path = pathForView(command?.view);
  if (command?.view !== "chat" && command?.view !== "ask") return path;
  const threadId =
    typeof command?.threadId === "string" ? command.threadId.trim() : "";
  return threadId ? chatThreadPath(threadId) : path;
}
