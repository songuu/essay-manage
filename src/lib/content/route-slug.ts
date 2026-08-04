export function decodeArticleRouteSlug(routeSlug: string): string | null {
  try {
    return decodeURIComponent(routeSlug);
  } catch {
    return null;
  }
}
