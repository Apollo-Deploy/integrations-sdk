import type {
  AppStoreCapability,
  TokenSet,
  Paginated,
  PaginationOpts,
  StoreReview,
  StoreReviewReply,
  StoreRating,
  RatingSummary,
  ReviewListOpts,
  RatingListOpts,
  RatingSummaryOpts,
} from '@apollo-deploy/integrations';
import { CapabilityError } from '@apollo-deploy/integrations';
import { mapGoogleReview, mapGoogleRatingSummary } from '../mappers/models.js';
import type { GooglePlayContext } from './_context.js';
import { BASE_URL } from './_context.js';

export function createGooglePlayReviews(
  ctx: GooglePlayContext,
): Pick<AppStoreCapability, 'listReviews' | 'getReview' | 'replyToReview' | 'deleteReviewReply' | 'getRatingSummary' | 'listRatings'> {
  const capability: ReturnType<typeof createGooglePlayReviews> = {
    async listReviews(
      tokens: TokenSet,
      packageName: string,
      opts?: ReviewListOpts,
    ): Promise<Paginated<StoreReview>> {
      const params = new URLSearchParams({ maxResults: String(opts?.limit ?? 20) });
      if (opts?.cursor) params.set('token', opts.cursor);

      const data = await ctx.gpRequest(
        tokens,
        `${BASE_URL}/applications/${packageName}/reviews?${params}`,
      );

      return {
        items: (data?.reviews ?? []).map(mapGoogleReview),
        hasMore: !!data?.tokenPagination?.nextPageToken,
        cursor: data?.tokenPagination?.nextPageToken,
      };
    },

    async getReview(
      tokens: TokenSet,
      packageName: string,
      reviewId: string,
    ): Promise<StoreReview> {
      const data = await ctx.gpRequest(
        tokens,
        `${BASE_URL}/applications/${packageName}/reviews/${reviewId}`,
      );
      return { ...mapGoogleReview(data), appId: packageName };
    },

    async replyToReview(
      tokens: TokenSet,
      packageName: string,
      reviewId: string,
      body: string,
    ): Promise<StoreReviewReply> {
      const data = await ctx.gpRequest<{ result: { replyText: string; lastEdited: { seconds: string } } }>(
        tokens,
        `${BASE_URL}/applications/${packageName}/reviews/${reviewId}:reply`,
        { method: 'POST', body: JSON.stringify({ replyText: body }) },
      );
      return {
        body: data.result?.replyText ?? body,
        updatedAt: data.result?.lastEdited?.seconds
          ? new Date(Number(data.result.lastEdited.seconds) * 1000)
          : new Date(),
      };
    },

    async deleteReviewReply(
      _tokens: TokenSet,
      _packageName: string,
      _reviewId: string,
    ): Promise<void> {
      throw new CapabilityError('google-play', 'Google Play API does not support deleting review replies.', false);
    },

    async getRatingSummary(
      tokens: TokenSet,
      packageName: string,
      _opts?: RatingSummaryOpts,
    ): Promise<RatingSummary> {
      const data = await ctx.gpRequest(
        tokens,
        `${BASE_URL}/applications/${packageName}/reviews?maxResults=1`,
      );
      return mapGoogleRatingSummary(packageName, data?.averageRating ? data : {});
    },

    async listRatings(
      tokens: TokenSet,
      packageName: string,
      opts?: RatingListOpts,
    ): Promise<Paginated<StoreRating>> {
      const reviewPage = await capability.listReviews(tokens, packageName, {
        limit: opts?.limit ?? 50,
        cursor: opts?.cursor,
      });

      const ratings = reviewPage.items.map((r): StoreRating => ({
        id: r.id,
        appId: packageName,
        rating: r.rating,
        territory: r.territory,
        appVersion: r.appVersion,
        createdAt: r.createdAt,
      }));

      return { items: ratings, hasMore: reviewPage.hasMore, cursor: reviewPage.cursor };
    },
  };

  return capability;
}
