export interface PageLifecycleActions {
  suspend(): void;
  dispose(): void;
}

export function handlePageHide(event: PageTransitionEvent, actions: PageLifecycleActions): void {
  if (event.persisted) {
    actions.suspend();
    return;
  }
  actions.dispose();
}
