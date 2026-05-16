/**
 * Returns true when an error is clearly a network failure (no connectivity),
 * rather than a server-side validation or auth error.
 * Used to decide whether to silently queue a mutation offline instead of
 * showing an error toast.
 */
export function isNetworkError(err: unknown): boolean {
  if (!navigator.onLine) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("network request failed") ||
      msg.includes("load failed") ||         // Safari
      msg.includes("the internet connection") // iOS
    );
  }
  return false;
}
