export type PublishPhase = "create" | "waiting" | "publishing" | "done";
export type PublishCheckpoint = {
  outcome: "waiting" | "publishing" | "published" | "failed" | "needs_review";
  containerId?: string;
  mediaId?: string;
  errorCode?: string;
};

export type InstagramStepDependencies = {
  createContainer: () => Promise<string>;
  readStatus: (id: string) => Promise<string>;
  publish: (id: string) => Promise<{ mediaId: string }>;
  // Must atomically persist against the current lease or throw. In particular,
  // publication is forbidden until the "publishing" checkpoint is committed.
  checkpoint: (value: PublishCheckpoint) => Promise<void>;
};

/** At most one processing query per invocation; unfinished media resumes next tick. */
export async function runInstagramPublishStep(
  post: { publish_phase: PublishPhase; meta_container_id: string | null },
  deps: InstagramStepDependencies,
): Promise<PublishCheckpoint["outcome"]> {
  let publicationStarted = false;
  let checkpointFailed = false;
  const checkpoint = async (value: PublishCheckpoint) => {
    try {
      await deps.checkpoint(value);
    } catch (error) {
      checkpointFailed = true;
      throw error;
    }
  };
  try {
    if (post.publish_phase === "publishing") {
      await checkpoint({ outcome: "needs_review", errorCode: "publish_interrupted" });
      return "needs_review";
    }
    if (post.publish_phase === "create") {
      const containerId = await deps.createContainer();
      if (!containerId) throw new Error("Missing container ID");
      await checkpoint({ outcome: "waiting", containerId });
      return "waiting";
    }
    if (post.publish_phase !== "waiting" || !post.meta_container_id) {
      throw new Error("Invalid publishing checkpoint");
    }
    const containerId = post.meta_container_id;
    const status = await deps.readStatus(containerId);
    if (status === "IN_PROGRESS") {
      await checkpoint({ outcome: "waiting", containerId });
      return "waiting";
    }
    if (status === "PUBLISHED") {
      await checkpoint({ outcome: "needs_review", errorCode: "container_already_published" });
      return "needs_review";
    }
    if (status !== "FINISHED") throw new Error("Media is unavailable or status unknown");
    await checkpoint({ outcome: "publishing", containerId });
    publicationStarted = true;
    const result = await deps.publish(containerId);
    if (!result.mediaId) throw new Error("Missing publication confirmation");
    await checkpoint({ outcome: "published", containerId, mediaId: result.mediaId });
    return "published";
  } catch (error) {
    // A lost database response must leave the lease for recovery. Never replace
    // a possibly committed success or publishing marker with a generic failure.
    if (checkpointFailed) throw error;
    const outcome = publicationStarted ? "needs_review" : "failed";
    await checkpoint({
      outcome,
      errorCode: publicationStarted ? "publish_outcome_ambiguous" : "preparation_failed",
    });
    return outcome;
  }
}
