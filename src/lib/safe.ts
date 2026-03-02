/** Whether the app is running inside a Safe Wallet iframe. */
export const isSafeApp =
  typeof window !== "undefined" && window.self !== window.top
