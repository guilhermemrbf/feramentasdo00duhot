export type FacebookInstagramAccount = {
  id?: string;
  username?: string;
  name?: string;
};

export type FacebookInstagramPage = {
  id?: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: FacebookInstagramAccount;
  connected_instagram_account?: FacebookInstagramAccount;
};

export type LinkedFacebookInstagramPage = {
  pageName: string | null;
  pageAccessToken: string;
  isBusinessAccount: boolean;
  ig: FacebookInstagramAccount & { id: string };
};

/** Accept professional Instagram accounts linked to a Page through either Graph API field. */
export function linkedFacebookInstagramPages(
  pages: FacebookInstagramPage[],
): LinkedFacebookInstagramPage[] {
  const linked: LinkedFacebookInstagramPage[] = [];
  for (const page of pages) {
    const businessAccount = page.instagram_business_account;
    const ig = businessAccount?.id ? businessAccount : page.connected_instagram_account;
    if (!page.access_token || !ig?.id) continue;
    linked.push({
      pageName: page.name ?? null,
      pageAccessToken: page.access_token,
      isBusinessAccount: Boolean(businessAccount?.id),
      ig: { ...ig, id: ig.id },
    });
  }
  return linked;
}
