import type {
  AppStoreCapability,
  TokenSet,
  Paginated,
  StoreReview,
  StoreReviewReply,
  StoreRating,
  RatingSummary,
  ReviewListOpts,
  RatingListOpts,
  RatingSummaryOpts,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import { mapGoogleReview, mapGoogleRatingSummary } from "../mappers/models.js";
import type { GooglePlayContext } from "./_context.js";

export function createGooglePlayReviews(
  ctx: GooglePlayContext,
): Pick<
  AppStoreCapability,
  | "listReviews"
  | "getReview"
  | "replyToReview"
  | "deleteReviewReply"
  | "getRatingSummary"
  | "listRatings"
> {
  const capability: ReturnType<typeof createGooglePlayReviews> = {
    async listReviews(
      _tokens: TokenSet,
      packageName: string,
      opts?: ReviewListOpts,
    ): Promise<Paginated<StoreReview>> {
      const data = await ctx.publisherRequest(
        ctx.client.reviews.list({
          packageName,
          maxResults: opts?.limit ?? 20,
          ...(opts?.cursor ? { token: opts.cursor } : {}),
        }),
      );

      return {
        items: (data?.reviews ?? []).map((r: Record<string, any>) => mapGoogleReview(r, packageName)),
        hasMore: !!data?.tokenPagination?.nextPageToken,
        cursor: data?.tokenPagination?.nextPageToken ?? undefined,
      };
    },

    async getReview(
      _tokens: TokenSet,
      packageName: string,
      reviewId: string,
    ): Promise<StoreReview> {
      const data = await ctx.publisherRequest(
        ctx.client.reviews.get({ packageName, reviewId }),
      );
      return mapGoogleReview(data, packageName);
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async replyToReview(
      _tokens: TokenSet,
      packageName: string,
      reviewId: string,
      body: string,
    ): Promise<StoreReviewReply> {
      const data = await ctx.publisherRequest<{
        result: { replyText: string; lastEdited: { seconds: string } };
      }>(
        ctx.client.reviews.reply({
          packageName,
          reviewId,
          requestBody: { replyText: body },
        }) as Promise<{
          data: { result: { replyText: string; lastEdited: { seconds: string } } };
        }>,
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
      throw new CapabilityError(
        "google-play",
        "Google Play API does not support deleting review replies.",
        false,
      );
    },

    async getRatingSummary(
      _tokens: TokenSet,
      packageName: string,
      _opts?: RatingSummaryOpts,
    ): Promise<RatingSummary> {
      const data = (await ctx.publisherRequest(
        ctx.client.reviews.list({ packageName, maxResults: 1 }),
      )) as Record<string, any>;
      return mapGoogleRatingSummary(
        packageName,
        data?.averageRating ? data : {},
      );
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

      const ratings = reviewPage.items.map(
        (r): StoreRating => ({
          id: r.id,
          appId: packageName,
          rating: r.rating,
          territory: r.territory,
          appVersion: r.appVersion,
          createdAt: r.createdAt,
        }),
      );

      return {
        items: ratings,
        hasMore: reviewPage.hasMore,
        cursor: reviewPage.cursor,
      };
    },
  };

  return capability;
}
