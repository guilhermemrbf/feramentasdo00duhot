export type FacebookInstagramPage = {
  id?: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: {
    id?: string;
    username?: string;
    name?: string;
  };
};

export type LinkedFacebookInstagramPage = {
  pageName: string | null;
  pageAccessToken: string;
  ig: NonNullable<FacebookInstagramPage["instagram_business_account"]>;
};

/** Only connect professional Instagram accounts that have a usable Page token. */
export function linkedFacebookInstagramPages(
  pages: FacebookInstagramPage[],
): LinkedFacebookInstagramPage[] {
  const linked: LinkedFacebookInstagramPage[] = [];
  for (const page of pages) {
    const ig = page.instagram_business_account;
    if (!page.access_token || !ig?.id || !ig.username) continue;
    linked.push({
      pageName: page.name ?? null,
      pageAccessToken: page.access_token,
      ig,
    });
  }
  return linked;
}
