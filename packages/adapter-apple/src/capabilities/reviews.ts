import type { AppStoreCapability } from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import { mapAppleReview } from "../mappers/models.js";
import type { AppleContext } from "./_context.js";

export function createAppleReviews(
  ctx: AppleContext,
): Pick<
  AppStoreCapability,
  | "listReviews"
  | "getReview"
  | "replyToReview"
  | "deleteReviewReply"
  | "getRatingSummary"
  | "listRatings"
> {
  const capability: ReturnType<typeof createAppleReviews> = {
    async listReviews(tokens, appId, opts) {
      const params = new URLSearchParams({ limit: String(opts?.limit ?? 20) });
      if (opts?.cursor) params.set("cursor", opts.cursor);

      if (opts?.sortBy === "rating") {
        params.set("sort", opts.sortOrder === "asc" ? "rating" : "-rating");
      } else {
        params.set(
          "sort",
          opts?.sortOrder === "asc" ? "createdDate" : "-createdDate",
        );
      }

      params.set("include", "response");

      if (opts?.territory) params.set("filter[territory]", opts.territory);
      if (opts?.appVersion) params.set("filter[version]", opts.appVersion);

      const data = await ctx.appleRequest(
        tokens,
        `/apps/${appId}/customerReviews?${params}`,
      );

      const responseMap = new Map<string, any>();
      for (const inc of data.included ?? []) {
        if (inc.type === "customerReviewResponses") {
          const reviewId = inc.relationships?.review?.data?.id;
          if (reviewId) responseMap.set(reviewId, inc);
        }
      }

      return {
        items: data.data.map((r: Record<string, any>) =>
          mapAppleReview(r as any, responseMap.get(r.id)),
        ),
        hasMore: !!data.links?.next,
        cursor: ctx.extractCursor(data.links?.next),
      };
    },

    async getReview(tokens, _appId, reviewId) {
      const data = await ctx.appleRequest(
        tokens,
        `/customerReviews/${reviewId}?include=response`,
      );
      const response = (data.included ?? []).find(
        (r: Record<string, unknown>) => r.type === "customerReviewResponses",
      );
      return mapAppleReview(data.data, response);
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async replyToReview(tokens, _appId, reviewId, body) {
      const result = await ctx.appleRequest(
        tokens,
        "/customerReviewResponses",
        {
          method: "POST",
          body: JSON.stringify({
            data: {
              type: "customerReviewResponses",
              attributes: { responseBody: body },
              relationships: {
                review: { data: { type: "customerReviews", id: reviewId } },
              },
            },
          }),
        },
      );

      return {
        body: result?.data?.attributes?.responseBody ?? body,
        updatedAt: new Date(),
      };
    },

    async deleteReviewReply(tokens, _appId, reviewId) {
      const review = await ctx.appleRequest(
        tokens,
        `/customerReviews/${reviewId}?include=response`,
      );
      const responseId = (review.included ?? []).find(
        (r: Record<string, unknown>) => r.type === "customerReviewResponses",
      )?.id as string | undefined;

      if (!responseId)
        throw new CapabilityError(
          "apple",
          "No developer reply found for this review",
          false,
        );

      await ctx.appleRequest(tokens, `/customerReviewResponses/${responseId}`, {
        method: "DELETE",
      });
    },

    async getRatingSummary(tokens, appId, _opts) {
      const reviews = await ctx.appleRequest(
        tokens,
        `/apps/${appId}/customerReviews?limit=200&sort=-createdDate`,
      );

      const histogram = {
        oneStar: 0,
        twoStar: 0,
        threeStar: 0,
        fourStar: 0,
        fiveStar: 0,
      };
      let total = 0;
      let sum = 0;

      for (const review of reviews.data ?? []) {
        const rating = review.attributes.rating as number;
        total++;
        sum += rating;
        if (rating === 1) histogram.oneStar++;
        else if (rating === 2) histogram.twoStar++;
        else if (rating === 3) histogram.threeStar++;
        else if (rating === 4) histogram.fourStar++;
        else if (rating === 5) histogram.fiveStar++;
      }

      return {
        appId,
        averageRating: total > 0 ? sum / total : 0,
        totalRatings: total,
        histogram,
      };
    },

    async listRatings(tokens, appId, opts) {
      const reviews = await capability.listReviews(tokens, appId, {
        limit: opts?.limit,
        cursor: opts?.cursor,
      });

      return {
        items: reviews.items.map((r) => ({
          id: r.id,
          appId: r.appId,
          rating: r.rating,
          territory: r.territory,
          appVersion: r.appVersion,
          createdAt: r.createdAt,
        })),
        hasMore: reviews.hasMore,
        cursor: reviews.cursor,
      };
    },
  };

  return capability;
}
