import "server-only";
import { cache } from "react";
import { getPublicPortfolio, getPublicProject } from "./public-portfolio";

/** Per-request memoization so metadata and the page share one read. */
export const loadPublicPortfolio = cache((username: string) => getPublicPortfolio(username));
export const loadPublicProject = cache((username: string, slug: string) =>
  getPublicProject(username, slug),
);
