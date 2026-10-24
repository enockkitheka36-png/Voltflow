export class WorkspaceLoadError extends Error {
  constructor(cause) {
    super("The workspace could not finish downloading. Please try again.", { cause });
    this.name = "WorkspaceLoadError";
  }
}

export function createWorkspaceLoader(importWorkspace) {
  let request = null;
  return () => {
    if (!request) {
      request = Promise.resolve().then(importWorkspace).then((module) => {
        const component = module?.default;
        const reactObject = component && ["react.memo", "react.forward_ref", "react.lazy"].some((kind) => component.$$typeof === Symbol.for(kind));
        if (typeof component !== "function" && !reactObject) throw new Error("Missing workspace entry.");
        return module;
      }).catch((cause) => {
        request = null;
        throw new WorkspaceLoadError(cause);
      });
    }
    return request;
  };
}
